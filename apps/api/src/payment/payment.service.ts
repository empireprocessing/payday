import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { PspService } from '../psp/psp.service'
import { OrderService } from '../order/order.service'
import { StoreService } from '../store/store.service'
import { MetaService } from '../meta/meta.service'

import { ShopifyService, ShopifyOrderData } from '../shopify/shopify.service'
import { WoocommerceService } from '../woocommerce/woocommerce.service'
import Stripe from 'stripe'
import { PaymentStatus, RoutingMode } from '@prisma/client'
import {
  CreatePaymentIntentDto,
  RecordPaymentAttemptDto,
  PaymentIntentResponse,
} from './interfaces/payment.interface'
import { DecryptedStorePSP } from '../psp/interfaces/psp.interface'
import { decryptPSPCredentials } from '../common/encryption'
import { getBusinessDayStartUTC } from '../common/business-day'

// Helper pour extraire shopifyId depuis platformConfig
function getShopifyId(store: any): string | null {
  if (store.platform === 'SHOPIFY' && store.platformConfig) {
    return (store.platformConfig as any).shopifyId || null;
  }
  return null;
}

// Helper pour extraire shopifyAccessToken depuis platformConfig
function getShopifyAccessToken(store: any): string | null {
  if (store.platform === 'SHOPIFY' && store.platformConfig) {
    return (store.platformConfig as any).accessToken || null;
  }
  return null;
}

@Injectable()
export class PaymentService {
  private readonly DEFAULT_STORE_DOMAIN = 'test-store.com'
  private readonly USAGE_WINDOW_HOURS = Number(process.env.USAGE_WINDOW_HOURS || 24)
  private readonly STRIPE_CHECK_CACHE_MINUTES = 15
  private readonly EXCHANGE_RATE_CACHE_HOURS = 24 // Cache les taux de change 24h

  private exchangeRatesCache: { rates: Record<string, number>; timestamp: number } | null = null

  constructor(
    private prisma: PrismaService,
    private pspService: PspService,
    private orderService: OrderService,
    private storeService: StoreService,
    private shopifyService: ShopifyService,
    private woocommerceService: WoocommerceService,
    private metaService: MetaService,
  ) {}

  /**
   * Récupère tous les paiements avec pagination et filtres
   */
  async getAllPayments(params?: {
    page?: number
    limit?: number
    status?: string
    storeId?: string
    pspId?: string
  }) {
    const page = params?.page || 1
    const limit = params?.limit || 50
    const skip = (page - 1) * limit

    const where: any = {}
    if (params?.status) {
      where.status = params.status
    }
    if (params?.storeId) {
      where.storeId = params.storeId
    }
    if (params?.pspId) {
      where.pspId = params.pspId
    }

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          store: { select: { id: true, name: true, domain: true } },
          psp: { select: { id: true, name: true, pspType: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ])

    return { data, total, page, limit }
  }

  /**
   * Convertit un montant d'une devise vers EUR
   * Utilise l'API exchangerate-api.com (gratuite, 1500 requêtes/mois)
   */
  private async convertToEUR(amountCents: number, fromCurrency: string): Promise<number> {
    // Si c'est déjà en EUR, pas de conversion
    if (fromCurrency === 'EUR') {
      return amountCents
    }

    try {
      // Vérifier le cache
      const now = Date.now()
      const cacheExpiry = this.EXCHANGE_RATE_CACHE_HOURS * 60 * 60 * 1000

      if (this.exchangeRatesCache && (now - this.exchangeRatesCache.timestamp) < cacheExpiry) {
        const rate = this.exchangeRatesCache.rates[fromCurrency]
        if (rate) {
          console.log(`💱 Using cached exchange rate: 1 EUR = ${rate} ${fromCurrency}`)
          return Math.round(amountCents / rate)
        }
      }

      // Si pas de cache ou devise non trouvée, faire un appel API
      console.log(`💱 Fetching exchange rates from API...`)
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/EUR')
      
      if (!response.ok) {
        throw new Error(`Exchange rate API error: ${response.status}`)
      }

      const data = await response.json()
      
      // Mettre en cache
      this.exchangeRatesCache = {
        rates: data.rates,
        timestamp: now
      }

      const rate = data.rates[fromCurrency]
      if (!rate) {
        console.warn(`⚠️ Exchange rate not found for ${fromCurrency}, using fallback 1:1`)
        return amountCents
      }

      console.log(`💱 Fresh exchange rate: 1 EUR = ${rate} ${fromCurrency}`)
      return Math.round(amountCents / rate)

    } catch (error) {
      console.error(`❌ Error converting currency: ${error.message}`)
      console.warn(`⚠️ Using fallback 1:1 conversion for ${fromCurrency}`)
      // En cas d'erreur, on fait une conversion 1:1 pour ne pas bloquer
      return amountCents
    }
  }

  /**
   * Envoie l'événement InitiateCheckout à Meta (non bloquant)
   */
  private async sendMetaInitiateCheckout(storeId: string, cartData: any): Promise<void> {
    try {
      const metaCredentials = await this.storeService.getMetaCredentials(storeId);
      if (!metaCredentials) return;

      const contentIds = cartData.items?.map((item: any) => item.productId || item.variantId) || [];
      const contents = cartData.items?.map((item: any) => ({
        id: item.productId || item.variantId,
        quantity: item.quantity,
        item_price: item.unitPrice,
      })) || [];

      await this.metaService.sendInitiateCheckoutEvent({
        pixelId: metaCredentials.pixelId,
        accessToken: metaCredentials.accessToken,
        eventData: {
          eventTime: Math.floor(Date.now() / 1000),
          currency: cartData.currency.toUpperCase(),
          value: cartData.totalAmount,
          contentIds,
          contents,
        },
      });
    } catch (error) {
      // Silently fail - non bloquant
    }
  }

  /**
   * Détecte le domaine du store depuis le cartId ou l'URL
   */
  private async detectStoreDomain(cartId?: string, referrer?: string, domainParam?: string): Promise<string> {
    // 1. Priorité au paramètre domain explicite
    if (domainParam) {
      console.log('🌐 Utilisation du domaine explicite:', domainParam)
      return domainParam
    }

    // 2. Essayer d'extraire le domaine depuis le referrer (headers HTTP)
    if (referrer) {
      try {
        const url = new URL(referrer)
        const hostname = url.hostname
        
        // Mapper les domaines connus
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          return 'localhost'
        }
        if (hostname.includes('dh53sa-ps.myshopify.com')) {
          return 'dh53sa-ps.myshopify.com'
        }
        
        return hostname
      } catch (error) {
        console.warn('Could not parse referrer URL:', referrer)
      }
    }

    // 3. Fallback : essayer d'extraire des infos du cartId Shopify
    if (cartId?.startsWith('gid://shopify/Cart/')) {
      // Pour Shopify, utiliser un domaine Shopify par défaut
      return 'dh53sa-ps.myshopify.com'
    }

    // 4. Default
    return this.DEFAULT_STORE_DOMAIN
  }

  /**
   * Récupère les informations du store et du cart pour le checkout
   */
  async getCheckoutInfo(cartId: string, domainParam?: string, referrer?: string) {
    try {
      // 1. Détecter le domaine du store avec la nouvelle logique
      const storeDomain = await this.detectStoreDomain(cartId, referrer, domainParam)
      console.log(`🏪 Domaine détecté: ${storeDomain}`)
      
      // 2. Récupérer le store par domaine ou payDomain
      let store
      if (domainParam) {
        // Si on a un paramètre domain, chercher par payDomain
        store = await this.storeService.getStoreByPayDomain(domainParam)
      } else {
        // Sinon, chercher par domain (logique existante)
        store = await this.storeService.getStoreByDomain(storeDomain)
      }
      
      if (!store) {
        throw new Error(`Store avec ${domainParam ? 'payDomain' : 'domaine'} ${storeDomain} non trouvé`)
      }
      console.log(cartId)
      // 3. Récupérer les données du panier Shopify
      // Construire le GID Shopify complet à partir du cartId de l'URL
      const shopifyCartId = cartId.startsWith('gid://shopify/Cart/') 
        ? cartId 
        : `gid://shopify/Cart/${cartId}`
      
      console.log('🔍 CartId original:', cartId)
      console.log('🔍 CartId Shopify:', shopifyCartId)

      const shopifyId = getShopifyId(store);
      if (!shopifyId) {
        throw new Error('Store is not a Shopify store');
      }

      const cartData = await this.shopifyService.getShopifyCart(shopifyCartId, shopifyId)
      if (!cartData) {
        throw new Error('Impossible de récupérer les données du panier')
      }

      console.log(`🏪 Store: ${store.name} (${store.domain}) - Montant: ${cartData.totalAmount} ${cartData.currency}`)

      // Récupérer le checkoutConfig séparément
      const storeWithConfig = await this.prisma.store.findUnique({
        where: { id: store.id },
        select: { checkoutConfig: true }
      })

      // 4. Retourner les informations formatées
      return {
        success: true,
        store: {
          id: store.id,
          name: store.name,
          domain: store.domain,
          logoUrl: store.logoUrl,
          supportEmail: store.supportEmail,
          requiresShipping: store.requiresShipping,
          checkoutConfig: storeWithConfig?.checkoutConfig || null
        },
        cart: {
          id: cartData.id,
          storeId: store.id,
          storeName: store.name,
          items: cartData.items,
          subtotal: cartData.subtotal,
          shippingCost: cartData.shippingCost,
          totalAmount: cartData.totalAmount,
          currency: cartData.currency,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des informations de checkout:', error)
      return {
        success: false,
        error: error.message || 'Impossible de récupérer les informations de checkout'
      }
    }
  }

  // Helpers de sélection et fallback
  private async getRoutingConfigOrDefault(storeId: string) {
    const config = await this.prisma.routingConfig.findUnique({
      where: { storeId },
      include: {
        pspWeights: true,
        fallbackSequence: {
          orderBy: { order: 'asc' }
        }
      }
    })

    if (config) return config

    return {
      id: 'default',
      storeId,
      mode: RoutingMode.AUTOMATIC,
      fallbackEnabled: true,
      maxRetries: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      pspWeights: [],
      fallbackSequence: []
    }
  }

  /**
   * Vérifie si un compte Stripe a charges_enabled et met à jour le cache en DB
   * Retourne true si le compte peut accepter des paiements
   */
  private async checkStripeAccountStatus(psp: DecryptedStorePSP['psp']): Promise<boolean> {
    const now = new Date()
    const cacheExpiry = this.STRIPE_CHECK_CACHE_MINUTES * 60 * 1000

    // Si on a un check récent (< 15 min), utiliser le cache
    if (psp.lastStripeCheck) {
      const timeSinceLastCheck = now.getTime() - new Date(psp.lastStripeCheck).getTime()
      if (timeSinceLastCheck < cacheExpiry) {
        console.log(`🔄 Using cached Stripe status for ${psp.name}: charges_enabled=${psp.stripeChargesEnabled}`)
        return psp.stripeChargesEnabled
      }
    }

    // Sinon, vérifier avec l'API Stripe
    try {
      console.log(`🔍 Checking Stripe account status for ${psp.name}...`)
      const stripe = this.createStripeInstance(psp.secretKey)
      const account = await stripe.accounts.retrieve()

      const chargesEnabled = account.charges_enabled ?? false
      const payoutsEnabled = account.payouts_enabled ?? false

      // Mettre à jour le cache en DB
      await this.prisma.psp.update({
        where: { id: psp.id },
        data: {
          stripeChargesEnabled: chargesEnabled,
          stripePayoutsEnabled: payoutsEnabled,
          lastStripeCheck: now,
        },
      })

      console.log(`✅ Stripe account ${psp.name}: charges_enabled=${chargesEnabled}, payouts_enabled=${payoutsEnabled}`)
      return chargesEnabled
    } catch (error) {
      console.error(`❌ Failed to check Stripe account status for ${psp.name}:`, error.message)
      // En cas d'erreur, on considère le compte comme non disponible
      await this.prisma.psp.update({
        where: { id: psp.id },
        data: {
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
          lastStripeCheck: now,
        },
      })
      return false
    }
  }

  private async getStripeCandidates(storeId: string, amountCents: number, currency: string, excludePspIds: string[] = []) {
    const storePsps = await this.pspService.getStorePSPs(storeId)
    const candidates = storePsps.filter(sp => sp.psp.pspType === 'stripe' && !excludePspIds.includes(sp.psp.id))

    // Convertir le montant en EUR pour la comparaison avec les caps
    const amountEurCents = await this.convertToEUR(amountCents, currency)
    console.log(`💱 Amount conversion: ${amountCents} ${currency} → ${amountEurCents} EUR (for PSP capacity comparison)`)

    // Calculer l'usage du jour ouvrable et 30d pour chaque candidat et filtrer ceux qui dépasseraient la capacité
    const candidatesWithUsage: Array<{ sp: DecryptedStorePSP; usageBusinessDay: number; usage30d: number }> = []

    for (const sp of candidates) {
      const [usageBusinessDay, usage30d] = await Promise.all([
        this.getBusinessDayUsage(sp.psp.id),
        this.get30dUsage(sp.psp.id),
      ])

      const dailyCap = sp.psp.dailyCapacityEur ?? null
      const monthCap = sp.psp.monthlyCapacityEur ?? null

      // Vérifier capacités avec jour ouvrable (tout est maintenant en EUR)
      if (dailyCap !== null && usageBusinessDay + amountEurCents > dailyCap) {
        console.log(`⚠️ PSP ${sp.psp.name} excluded: business day usage ${usageBusinessDay} + ${amountEurCents} (${amountCents} ${currency}) > daily cap ${dailyCap}`)
        continue
      }
      if (monthCap !== null && usage30d + amountEurCents > monthCap) {
        console.log(`⚠️ PSP ${sp.psp.name} excluded: 30d usage ${usage30d} + ${amountEurCents} (${amountCents} ${currency}) > monthly cap ${monthCap}`)
        continue
      }

      candidatesWithUsage.push({ sp, usageBusinessDay, usage30d })
    }

    // Vérifier le statut Stripe (charges_enabled) pour chaque candidat
    const validCandidates: Array<{ sp: DecryptedStorePSP; usageBusinessDay: number; usage30d: number }> = []
    for (const candidate of candidatesWithUsage) {
      const isEnabled = await this.checkStripeAccountStatus(candidate.sp.psp)
      if (isEnabled) {
        validCandidates.push(candidate)
      } else {
        console.log(`⚠️ PSP ${candidate.sp.psp.name} excluded: charges_enabled=false`)
      }
    }

    // Attacher l'usage jour ouvrable/30d au PSP pour la sélection (utilisé par selectNextPsp)
    return validCandidates.map(c => {
      // On stocke l'usage dans des propriétés temporaires pour le tri
      (c.sp as any)._usageBusinessDay = c.usageBusinessDay;
      (c.sp as any)._usage30d = c.usage30d;
      return c.sp;
    })
  }

  private async computeUsageShares(storeId: string, pspIds: string[]): Promise<Map<string, number>> {
    if (pspIds.length === 0) return new Map()
    const since = new Date(Date.now() - this.USAGE_WINDOW_HOURS * 60 * 60 * 1000)
    // Regrouper par pspId les montants SUCCESS pour ce store sur la fenêtre
    const grouped = await this.prisma.payment.groupBy({
      by: ['pspId'],
      where: {
        pspId: { in: pspIds },
        status: PaymentStatus.SUCCESS,
        createdAt: { gte: since },
        // Restreindre au store via metadata (stockée lors de la création de PI)
        pspMetadata: {
          path: ['storeId'],
          equals: storeId,
        }
      },
      _sum: { amount: true }
    })
    const sumsMap = new Map<string, number>()
    let total = 0
    for (const g of grouped) {
      const sum = g._sum.amount || 0
      if (g.pspId) {
        sumsMap.set(g.pspId, sum)
        total += sum
      }
    }
    const shares = new Map<string, number>()
    for (const pspId of pspIds) {
      const sum = sumsMap.get(pspId) || 0
      const share = total > 0 ? sum / total : 0
      shares.set(pspId, share)
    }
    return shares
  }

  private computeHeadroomRatio(sp: DecryptedStorePSP): number {
    const dailyCap = sp.psp.dailyCapacityEur ?? null
    const monthCap = sp.psp.monthlyCapacityEur ?? null
    // Utiliser l'usage du jour ouvrable stocké temporairement par getStripeCandidates
    const dayUsage = (sp as any)._usageBusinessDay || 0
    const monthUsage = (sp as any)._usage30d || 0
    const dayRatio = dailyCap ? Math.max(0, Math.min(1, (dailyCap - dayUsage) / dailyCap)) : 1
    const monthRatio = monthCap ? Math.max(0, Math.min(1, (monthlyCapSafe(monthCap) - monthUsage) / monthlyCapSafe(monthCap))) : 1
    return Math.min(dayRatio, monthRatio)
  }

  private async selectNextPsp(
    storeId: string,
    amountCents: number,
    currency: string,
    excludePspIds: string[] = [],
    checkoutId?: string
  ): Promise<DecryptedStorePSP | null> {
    const config = await this.getRoutingConfigOrDefault(storeId)
    const candidates = await this.getStripeCandidates(storeId, amountCents, currency, excludePspIds)
    if (candidates.length === 0) return null

    // Si on est en fallback (il y a déjà des exclusions) et qu'une séquence est définie, la respecter
    if (excludePspIds.length > 0 && config.fallbackSequence && config.fallbackSequence.length > 0) {
      const order = config.fallbackSequence
        .map(x => x.pspId)
        .filter(pspId => !excludePspIds.includes(pspId))
      for (const pspId of order) {
        const found = candidates.find(c => c.psp.id === pspId)
        if (found) return found
      }
      // Si aucun trouvé selon la séquence, on retombera sur la logique de sélection ci-dessous
    }

    if (config.mode === RoutingMode.MANUAL) {
      const weightMap = new Map<string, number>()
      for (const w of config.pspWeights) {
        weightMap.set(w.pspId, Math.max(0, w.weight))
      }
      const weights = candidates.map(sp => {
        const headroom = this.computeHeadroomRatio(sp)
        const manualWeight = weightMap.get(sp.psp.id) ?? 1
        return { sp, weight: headroom * manualWeight }
      })
      return weightedPick(weights, checkoutId)
    }

    // AUTOMATIC: Répartition équitable simple
    // → Choisir le PSP avec le plus petit usage du jour ouvrable (depuis 6h Paris)
    candidates.sort((a, b) => {
      const usageA = (a as any)._usageBusinessDay || 0
      const usageB = (b as any)._usageBusinessDay || 0
      return usageA - usageB // Tri croissant
    })

    console.log('🎯 Répartition automatique équitable (jour ouvrable depuis 6h Paris):')
    candidates.forEach(c => {
      console.log(`  - ${c.psp.name}: ${(c as any)._usageBusinessDay || 0} centimes (jour ouvrable)`)
    })
    console.log(`  → Sélection: ${candidates[0].psp.name} (le moins chargé)`)

    return candidates[0] // Prendre celui avec le moins d'usage
  }

  /**
   * Nettoie les données du panier pour le stockage en base (supprime les URLs d'images)
   */
  private cleanCartDataForStorage(cartData: any) {
    const cleanedItems = cartData.items.map((item: any) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      name: item.name,
      variantTitle: item.variantTitle,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      // Supprimer l'image car les URLs sont très longues
    }))

    return {
      items: cleanedItems,
      subtotal: cartData.subtotal,
      shippingCost: cartData.shippingCost,
      totalAmount: cartData.totalAmount
    }
  }

  /**
   * Crée une instance Stripe avec les credentials du PSP sélectionné
   */
  private createStripeInstance(secretKey: string) {
    console.log('🔑 Creating Stripe instance with key:', secretKey?.substring(0, 20) + '...')

    if (!secretKey) {
      throw new Error('Secret key is undefined or empty')
    }

    if (!secretKey.startsWith('sk_')) {
      throw new Error(`Invalid secret key format: ${secretKey.substring(0, 10)}...`)
    }

    try {
      return new Stripe(secretKey, {
        typescript: true,
      })
    } catch (error) {
      console.error('❌ Error creating Stripe instance:', error)
      console.error('❌ Secret key was:', secretKey?.substring(0, 20) + '...')
      throw error
    }
  }

  /**
   * Enregistre un événement de checkout (pour analytics et funnel)
   */
  private async recordCheckoutEvent(checkoutId: string, step: string) {
    try {
      await this.prisma.checkoutEvent.create({
        data: {
          checkoutId,
          step: step as any, // Cast to CheckoutStep enum
        },
      })
      console.log(`📊 Event enregistré: ${step} pour checkout ${checkoutId}`)
    } catch (error) {
      console.warn(`⚠️ Erreur lors de l'enregistrement de l'événement ${step}:`, error)
      // Ne pas bloquer le paiement si le tracking échoue
    }
  }

  private async recordAttemptRow(params: {
    orderId?: string | null
    checkoutId?: string
    storeId: string
    pspId: string
    pspPaymentId?: string | null
    pspIntentId?: string | null
    clientSecret?: string | null
    amount: number
    currency: string
    status: PaymentStatus
    pspMetadata?: any
    failureReason?: string | null
    attemptNumber: number
    isFallback: boolean
    processingTimeMs?: number | null
  }) {
    const { attemptNumber, isFallback, processingTimeMs, ...rest } = params
    
    // Créer l'enregistrement de paiement
    const payment = await this.prisma.payment.create({
      data: {
        ...rest,
        attemptNumber,
        isFallback,
        processingTimeMs,
      },
    })

    // Mettre à jour les champs de tracking dans le checkout
    if (params.checkoutId) {
      await this.prisma.checkout.update({
        where: { id: params.checkoutId },
        data: {
          totalAttempts: {
            increment: 1
          },
          lastAttemptAt: new Date(),
          lastAttemptStatus: params.status,
          lastAttemptPspId: params.pspId,
        },
      })

      // Enregistrer les événements de succès ou échec pour analytics
      if (params.status === PaymentStatus.SUCCESS) {
        await this.recordCheckoutEvent(params.checkoutId, 'PAYMENT_SUCCESSFUL')
      } else if (params.status === PaymentStatus.FAILED) {
        await this.recordCheckoutEvent(params.checkoutId, 'PAYMENT_FAILED')
      }
    }

    return payment
  }

  /**
   * Calcule l'usage d'un PSP sur le jour ouvrable actuel
   * (depuis 6h00 Paris jusqu'au prochain 6h00 Paris)
   */
  private async getBusinessDayUsage(pspId: string): Promise<number> {
    const since = getBusinessDayStartUTC()
    const result = await this.prisma.payment.aggregate({
      where: {
        pspId,
        status: PaymentStatus.SUCCESS,
        createdAt: { gte: since },
      },
      _sum: { amount: true },
    })
    return result._sum.amount || 0
  }

  /**
   * Calcule l'usage d'un PSP sur les 30 derniers jours (fenêtre glissante)
   */
  private async get30dUsage(pspId: string): Promise<number> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
    const result = await this.prisma.payment.aggregate({
      where: {
        pspId,
        status: PaymentStatus.SUCCESS,
        createdAt: { gte: since },
      },
      _sum: { amount: true },
    })
    return result._sum.amount || 0
  }

  async createPaymentIntent(data: CreatePaymentIntentDto): Promise<PaymentIntentResponse> {
    try {
      // Déterminer le store
      let storeId = data.storeId
      if (!storeId) {
        const defaultStore = await this.storeService.getStoreByDomain(this.DEFAULT_STORE_DOMAIN)
        if (!defaultStore) throw new Error('Store par défaut non trouvé. Exécutez la seed!')
        storeId = defaultStore.id
      }

      const amountCents = Math.round(data.amount * 100)
      const config = await this.getRoutingConfigOrDefault(storeId!)

      const attempted: string[] = []

      // En mode AUTOMATIC : pas de fallback (maxAttempts = 1)
      // En mode MANUAL : fallback activé si configuré
      const maxAttempts = config.mode === RoutingMode.AUTOMATIC
        ? 1
        : (1 + (config.fallbackEnabled ? config.maxRetries : 0))

      let attemptNumber = 1
      let lastError: any = null

      while (attemptNumber <= maxAttempts) {
        const selectedPSP = await this.selectNextPsp(storeId!, amountCents, data.currency || 'EUR', attempted, undefined)
        if (!selectedPSP) break
        const start = Date.now()
        try {
          const stripe = this.createStripeInstance(selectedPSP.psp.secretKey)
          const customer = await stripe.customers.create({})
          const paymentIntent = await stripe.paymentIntents.create({
            amount: amountCents,
            currency: (data.currency || 'usd').toLowerCase(),
            // payment_method_types: ['card', 'paypal', 'klarna'],
            automatic_payment_methods: {
              enabled: true,
            },
            customer: customer.id,
            setup_future_usage: 'off_session',
            // Plus besoin de métadonnées - toutes les données sont dans pspMetadata
          })
          // Enregistrer tentative PENDING
          await this.recordAttemptRow({
            orderId: null,
            storeId: storeId!,
            pspId: selectedPSP.psp.id,
            pspIntentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret || undefined,
            amount: amountCents,
            currency: (data.currency || 'usd').toUpperCase(),
            status: PaymentStatus.PENDING,
            pspMetadata: {
              pspType: selectedPSP.psp.pspType,
              storeId: storeId!,
              customerId: customer.id,
              amount: data.amount,
              customerEmail: data.customerEmail,
            },
            failureReason: undefined,
            attemptNumber,
            isFallback: attemptNumber > 1,
            processingTimeMs: Date.now() - start,
          })

          return {
            success: true,
            clientSecret: paymentIntent.client_secret || undefined,
            paymentIntentId: paymentIntent.id,
            publishableKey: selectedPSP.psp.publicKey,
          }
        } catch (e) {
          lastError = e
          // Enregistrer tentative échouée de création
          await this.recordAttemptRow({
            orderId: null,
            storeId: storeId!,
            pspId: selectedPSP.psp.id,
            amount: amountCents,
            currency: (data.currency || 'usd').toUpperCase(),
            status: PaymentStatus.FAILED,
            pspMetadata: { creationStage: 'payment_intent', storeId: storeId! },
            failureReason: (e as any)?.message || 'creation_failed',
            attemptNumber,
            isFallback: attemptNumber > 1,
            processingTimeMs: Date.now() - start,
          })
          attempted.push(selectedPSP.psp.id)
          attemptNumber += 1
          continue
        }
      }

      return { success: false, error: 'Impossible de créer le paiement' }
    } catch (error) {
      console.error('Erreur lors de la création du Payment Intent:', error)
      return { success: false, error: 'Impossible de créer le paiement' }
    }
  }

  // Enregistrer une tentative de paiement
  async recordPaymentAttempt(data: RecordPaymentAttemptDto) {
    return await this.prisma.payment.create({
      data: {
        orderId: data.orderId,
        storeId: data.storeId,
        pspId: data.pspId,
        pspPaymentId: data.pspPaymentId,
        pspIntentId: data.pspIntentId,
        amount: data.amount,
        currency: data.currency || 'USD',
        status: data.status,
        pspMetadata: data.pspMetadata,
        failureReason: data.failureReason,
      },
    })
  }

  // Mettre à jour le statut d'un paiement
  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    pspMetadata?: any,
    failureReason?: string
  ) {
    return await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status,
        pspMetadata,
        failureReason,
        updatedAt: new Date(),
      },
    })
  }

  async confirmPayment(
    paymentIntentId: string, 
    customerData?: {
      email?: string
      name?: string
      phone?: string
      address?: {
        line1?: string
        line2?: string
        city?: string
        postal_code?: string
        country?: string
        state?: string
      }
    }
  ) {
    try {
      // 1. Récupérer l'enregistrement de paiement depuis la base
      const paymentRecord = await this.prisma.payment.findFirst({
        where: { pspIntentId: paymentIntentId },
        include: { 
          psp: true,
          order: {
            include: {
              store: true
            }
          }
        }
      })

      if (!paymentRecord) {
        throw new Error('Enregistrement de paiement non trouvé')
      }

      // Déterminer les credentials PSP pour lire le PaymentIntent
      let secretKeyToUse: string | null = null
      try {
        // Récupérer le PSP global et déchiffrer directement
        if (!paymentRecord.pspId) {
          throw new Error('Payment record has no PSP ID')
        }
        const psp = await this.prisma.psp.findUnique({ where: { id: paymentRecord.pspId } })
        if (!psp) throw new Error('PSP introuvable')
        const dec = decryptPSPCredentials({ publicKey: psp.publicKey, secretKey: psp.secretKey })
        secretKeyToUse = dec.secretKey
      } catch (e) {
        // Fallback via StorePSP si le store est disponible
        const storeIdFromOrder = paymentRecord.order?.storeId
        if (storeIdFromOrder) {
          const storePSPs = await this.pspService.getStorePSPs(storeIdFromOrder)
          const selected = storePSPs.find(sp => sp.psp.id === paymentRecord.pspId)
          if (selected) secretKeyToUse = selected.psp.secretKey
        }
      }

      if (!secretKeyToUse) {
        throw new Error('Impossible de récupérer la clé du PSP pour confirmer le paiement')
      }

      const stripeInstance = this.createStripeInstance(secretKeyToUse)
      const paymentIntent = await stripeInstance.paymentIntents.retrieve(paymentIntentId)

      // Si on a des données client, compléter le Customer existant ou créer si nécessaire
      if (customerData && customerData.email) {
        let customerId = paymentIntent.customer as string

        if (customerId) {
          // Le Customer existe déjà (créé lors du PaymentIntent), on le complète
          console.log('🧑‍💼 Complétion du Customer Stripe existant:', customerId, 'avec email:', customerData.email)
          
          // Préparer les données de mise à jour du customer Stripe
          const customerUpdateData: any = {
            email: customerData.email,
          }
          
          // Ajouter le nom si disponible
          if (customerData.name) {
            customerUpdateData.name = customerData.name
          }
          
          // Ajouter le téléphone si disponible
          if (customerData.phone) {
            customerUpdateData.phone = customerData.phone
          }
          
          // Ajouter l'adresse si disponible
          if (customerData.address) {
            customerUpdateData.address = {
              line1: customerData.address.line1,
              line2: customerData.address.line2,
              city: customerData.address.city,
              postal_code: customerData.address.postal_code,
              country: customerData.address.country,
              state: customerData.address.state,
            }
          }
          
          const customer = await stripeInstance.customers.update(customerId, customerUpdateData)
          console.log('✅ Customer Stripe complété:', customer.id, customer.email)
        } else {
          // Fallback : créer un nouveau Customer si aucun n'existe (cas rare)
          console.log('🧑‍💼 Création d\'un nouveau Customer Stripe (fallback):', customerData.email)
          
          const customerCreateData: any = {
            email: customerData.email,
          }
          
          if (customerData.name) customerCreateData.name = customerData.name
          if (customerData.phone) customerCreateData.phone = customerData.phone
          if (customerData.address) {
            customerCreateData.address = {
              line1: customerData.address.line1,
              line2: customerData.address.line2,
              city: customerData.address.city,
              postal_code: customerData.address.postal_code,
              country: customerData.address.country,
              state: customerData.address.state,
            }
          }
          
          const customer = await stripeInstance.customers.create(customerCreateData)
          console.log('✅ Customer Stripe créé (fallback):', customer.id, customer.email)
          
          // Associer au PaymentIntent
          await stripeInstance.paymentIntents.update(paymentIntentId, { 
            customer: customer.id 
          })
          customerId = customer.id
        }

        // Attacher le payment method au customer pour les paiements futurs
        // Sauf pour Express Checkout (Apple Pay/Google Pay) où le payment method est à usage unique
        const pspMetadata = paymentRecord.pspMetadata as any
        const isExpressCheckout = pspMetadata?.isExpressCheckout === true

        if (paymentIntent.payment_method && customerId && !isExpressCheckout) {
          console.log('💳 Attachement du payment method au customer:', paymentIntent.payment_method)
          await stripeInstance.paymentMethods.attach(paymentIntent.payment_method as string, {
            customer: customerId,
          })
          console.log('✅ Payment method attaché au customer')

          // Définir comme méthode de paiement par défaut
          console.log('🎯 Définition comme payment method par défaut')
          await stripeInstance.customers.update(customerId, {
            invoice_settings: {
              default_payment_method: paymentIntent.payment_method as string,
            },
          })
          console.log('✅ Payment method défini comme défaut')
        } else if (isExpressCheckout) {
          console.log('🍎 Express Checkout détecté - pas d\'attachement du payment method (usage unique)')
        }
      }

      if (paymentIntent.status === 'succeeded') {
        // 2. Créer l'ordre maintenant que le paiement est confirmé
        // Récupérer les données du panier depuis pspMetadata au lieu des métadonnées Stripe
        const pspMetadata = paymentRecord.pspMetadata as any
        const cartDataFromMetadata = pspMetadata?.cartData || {}
        
        // Déterminer le store
        const storeId = paymentRecord.storeId
        if (!storeId) {
          throw new Error('Store non trouvé pour ce paiement')
        }
        
        const order = await this.orderService.createOrder({
          storeId: storeId,
          customerEmail: customerData?.email || 'customer@example.com',
          subtotal: Math.round(cartDataFromMetadata.subtotal * 100),
          shippingCost: Math.round(cartDataFromMetadata.shippingCost * 100),
          totalAmount: Math.round(cartDataFromMetadata.totalAmount * 100),
          currency: paymentIntent.currency.toUpperCase(),
          items: cartDataFromMetadata.items?.map((item: any) => ({
            productId: item.productId, // ID du produit Shopify
            quantity: item.quantity,
            unitPrice: Math.round(item.unitPrice * 100),
            name: item.name,
            description: item.description || '',
            image: item.image || null
          })) || [],
        })

        // 3. Mettre à jour le payment record avec l'ordre et le statut SUCCESS
        await this.prisma.payment.update({
          where: { id: paymentRecord.id },
          data: {
            orderId: order.id,
            status: PaymentStatus.SUCCESS,
          }
        })

        // Note: L'usage PSP est maintenant calculé dynamiquement depuis les paiements (24h/30d glissant)

        // 4. Mettre à jour l'ordre avec les vraies données client et le statut CONFIRMED
        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'CONFIRMED',
            paymentStatus: 'SUCCESS',
            ...(customerData && customerData.email ? {
              customerEmail: customerData.email,
              metadata: {
                customerName: customerData.name,
                customerPhone: customerData.phone,
                shippingAddress: customerData.address,
                billingAddress: customerData.address,
              }
            } : {})
          }
        })
        console.log('✅ Ordre confirmé et mis à jour avec les données client:', customerData?.email || 'email non fourni')

        // 4.5. Envoyer l'événement Purchase à Meta Conversion API
        if (customerData && customerData.email) {
          try {
            const metaCredentials = await this.storeService.getMetaCredentials(storeId)

            if (metaCredentials) {
              // Vérifier si on doit envoyer l'événement (newCustomersOnly)
              let shouldSendEvent = true
              if (metaCredentials.newCustomersOnly) {
                shouldSendEvent = await this.metaService.isNewCustomer(
                  customerData.email,
                  storeId,
                  this.prisma
                )
              }

              if (shouldSendEvent) {
                // Préparer les données de l'événement
                const contentIds = cartDataFromMetadata.items?.map((item: any) => item.productId || item.variantId) || []
                const contents = cartDataFromMetadata.items?.map((item: any) => ({
                  id: item.productId || item.variantId,
                  quantity: item.quantity,
                  item_price: item.unitPrice,
                })) || []

                await this.metaService.sendPurchaseEvent({
                  pixelId: metaCredentials.pixelId,
                  accessToken: metaCredentials.accessToken,
                  eventData: {
                    eventTime: Math.floor(Date.now() / 1000),
                    eventId: order.id, // Utiliser l'order ID pour déduplication
                    email: customerData.email,
                    phone: customerData.phone,
                    firstName: customerData.name?.split(' ')[0],
                    lastName: customerData.name?.split(' ').slice(1).join(' '),
                    city: customerData.address?.city,
                    state: customerData.address?.state,
                    zip: customerData.address?.postal_code,
                    country: customerData.address?.country,
                    currency: paymentIntent.currency.toUpperCase(),
                    value: order.totalAmount / 100, // Convertir centimes en unité
                    contentIds,
                    contentType: 'product',
                    contents,
                  },
                })
              }
            }
          } catch (metaError) {
            // Silently fail - logs are handled in MetaService
          }
        }

        // 5. Récupérer l'ordre complet avec toutes les relations
        const completeOrder = await this.prisma.order.findUnique({
          where: { id: order.id },
          include: {
            items: true,
            store: true
          }
        })

        if (!completeOrder) {
          throw new Error('Impossible de récupérer l\'ordre complet après création')
        }

        console.log('✅ Paiement réussi:', paymentIntent.id)

        // Créer l'ordre Shopify si on a les données client et que c'est un store Shopify
        let shopifyOrder = null
        if (customerData && customerData.email) {
          try {
            // Vérifier si c'est un store Shopify via le champ platform
            const store = await this.storeService.getStoreById(order.storeId)
            const isShopifyStore = store?.platform === 'SHOPIFY'

            if (isShopifyStore && store) {
              console.log('🏪 Création de l\'ordre Shopify pour le store:', store.name, '-', store.domain)

              // Créer l'ordre Shopify si configuré
              const shopifyId = getShopifyId(store);
              const shopifyAccessToken = getShopifyAccessToken(store);
              if (shopifyId && shopifyAccessToken) {
                try {
                  console.log(`🏪 Création de l'ordre Shopify pour le store: ${shopifyId}.myshopify.com`)

                  // Récupérer le checkout pour obtenir les données du panier
                  const checkout = await this.prisma.checkout.findFirst({
                    where: {
                      id: paymentRecord.checkoutId || '',
                      storeId: store.id
                    }
                  })

                  if (!checkout) {
                    throw new Error('Checkout not found for Shopify order creation')
                  }

                  const cartData = checkout.cartData as any

                  // Déterminer le type de paiement (express checkout ou carte)
                  const isExpressCheckout = pspMetadata?.isExpressCheckout === true

                  const shopifyOrderData: ShopifyOrderData = {
                    email: customerData.email,
                    name: customerData.name || 'Customer',
                    phone: customerData.phone,
                    address: {
                      line1: customerData.address?.line1 || '',
                      line2: customerData.address?.line2,
                      city: customerData.address?.city || '',
                      postal_code: customerData.address?.postal_code || '',
                      country: customerData.address?.country || 'FR',
                      state: customerData.address?.state || '',
                    },
                    cartId: checkout.cartId, // Utiliser le cartId du checkout
                    paymentIntentId: paymentIntent.id,
                    paymentMethod: isExpressCheckout ? 'express_checkout' : 'card',
                  }

                  // Créer l'ordre Shopify directement comme payée (par boutique)
                  const shopDomain = `${shopifyId}.myshopify.com`
                  shopifyOrder = await this.shopifyService.createPaidOrder(shopifyOrderData, {
                    shopDomain,
                    accessToken: shopifyAccessToken,
                  })
                  console.log('✅ Ordre Shopify créée et marquée comme payée:', shopifyOrder.id, shopifyOrder.name, shopifyOrder.financial_status)
                } catch (shopifyError) {
                  console.error('⚠️ Erreur lors de la création de l\'ordre Shopify (non bloquant):', shopifyError)
                }
              }
            }

            // Créer l'ordre WooCommerce si c'est un store WooCommerce
            const isWooCommerceStore = store?.platform === 'WOOCOMMERCE'
            if (isWooCommerceStore && store) {
              console.log('🛒 Création de l\'ordre WooCommerce pour le store:', store.domain)

              try {
                // Récupérer les credentials WooCommerce
                const credentials = await this.woocommerceService.getStoreCredentials(store.id)
                if (!credentials) {
                  throw new Error('WooCommerce credentials not found')
                }

                // Récupérer le checkout pour les données du panier
                const checkout = await this.prisma.checkout.findFirst({
                  where: {
                    id: paymentRecord.checkoutId || '',
                    storeId: store.id
                  }
                })

                if (!checkout) {
                  throw new Error('Checkout not found for WooCommerce order creation')
                }

                const cartData = checkout.cartData as any

                // Construire les line_items pour WooCommerce
                const lineItems = cartData.items?.map((item: any) => ({
                  product_id: parseInt(item.productId),
                  variation_id: item.variantId && item.variantId !== item.productId ? parseInt(item.variantId) : 0,
                  quantity: item.quantity,
                })) || []

                // Construire les données de l'ordre WooCommerce
                const wooOrderData = {
                  payment_method: 'heypay',
                  payment_method_title: 'HeyPay',
                  set_paid: true, // Marquer comme payé
                  billing: {
                    first_name: customerData.name?.split(' ')[0] || 'Customer',
                    last_name: customerData.name?.split(' ').slice(1).join(' ') || '',
                    address_1: customerData.address?.line1 || '',
                    address_2: customerData.address?.line2 || '',
                    city: customerData.address?.city || '',
                    state: customerData.address?.state || '',
                    postcode: customerData.address?.postal_code || '',
                    country: customerData.address?.country || 'FR',
                    email: customerData.email,
                    phone: customerData.phone || '',
                  },
                  shipping: {
                    first_name: customerData.name?.split(' ')[0] || 'Customer',
                    last_name: customerData.name?.split(' ').slice(1).join(' ') || '',
                    address_1: customerData.address?.line1 || '',
                    address_2: customerData.address?.line2 || '',
                    city: customerData.address?.city || '',
                    state: customerData.address?.state || '',
                    postcode: customerData.address?.postal_code || '',
                    country: customerData.address?.country || 'FR',
                  },
                  line_items: lineItems,
                  meta_data: [
                    {
                      key: '_heypay_payment_id',
                      value: paymentIntent.id
                    },
                    {
                      key: '_heypay_order_id',
                      value: order.id
                    }
                  ]
                }

                // Créer l'ordre dans WooCommerce
                const wooOrder = await this.woocommerceService.createOrder(wooOrderData, credentials)
                console.log('✅ Ordre WooCommerce créée et marquée comme payée:', wooOrder.id, wooOrder.number)

              } catch (wooError) {
                console.error('⚠️ Erreur lors de la création de l\'ordre WooCommerce (non bloquant):', wooError)
              }
            }
          } catch (err) {
            console.error('⚠️ Erreur lors de la création de l\'ordre dans la plateforme (non bloquant):', err)
          }
        }

        // Formater les données pour la page de remerciement
        const orderData = {
          id: completeOrder.id,
          confirmationNumber: completeOrder.id.slice(-8).toUpperCase(),
          customerEmail: customerData?.email || completeOrder.customerEmail,
          shippingAddress: {
            name: customerData?.name || 'Client',
            address: customerData?.address?.line1 || 'Adresse non fournie',
            line2: customerData?.address?.line2 || '',
            city: customerData?.address?.city || 'Ville non fournie',
            postalCode: customerData?.address?.postal_code || '',
            country: customerData?.address?.country || 'Pays non fourni'
          },
          billingAddress: {
            name: customerData?.name || 'Client',
            address: customerData?.address?.line1 || 'Adresse non fournie',
            line2: customerData?.address?.line2 || '',
            city: customerData?.address?.city || 'Ville non fournie',
            postalCode: customerData?.address?.postal_code || '',
            country: customerData?.address?.country || 'Pays non fourni'
          },
          shippingMethod: 'Colissimo Express',
          items: completeOrder.items.map(item => ({
            id: item.id,
            name: item.name,
            description: item.description || '',
            quantity: item.quantity,
            price: item.unitPrice / 100, // Convertir de centimes en euros
            image: item.image
          })),
          pricing: {
            subtotal: completeOrder.subtotal / 100,
            shipping: completeOrder.shippingCost / 100,
            total: completeOrder.totalAmount / 100,
            currency: completeOrder.currency.toUpperCase()
          },
          store: {
            name: completeOrder.store.name,
            domain: completeOrder.store.domain,
            supportEmail: completeOrder.store.supportEmail,
            requiresShipping: completeOrder.store.requiresShipping,
            platform: completeOrder.store.platform,
          },
          paymentStatus: completeOrder.paymentStatus,
          createdAt: completeOrder.createdAt
        }

        return {
          success: true,
          paymentIntent,
          order: orderData,
          shopifyOrder,
        }
      }

      // Si le paiement a échoué côté Stripe, marquer comme FAILED
      const failedStatuses = ['canceled', 'requires_payment_method']
      if (failedStatuses.includes(paymentIntent.status)) {
        console.log(`❌ Paiement échoué (${paymentIntent.status}):`, paymentIntentId)
        await this.prisma.payment.update({
          where: { id: paymentRecord.id },
          data: {
            status: PaymentStatus.FAILED,
            failureReason: paymentIntent.last_payment_error?.message || paymentIntent.status,
          }
        })
        return {
          success: false,
          error: paymentIntent.last_payment_error?.message || 'Le paiement a échoué',
        }
      }

      // Statut intermédiaire (processing, requires_action, etc.) - laisser en PENDING
      return {
        success: false,
        error: 'Le paiement n\'a pas été confirmé',
      }
    } catch (error) {
      console.error('Erreur lors de la confirmation du paiement:', error)
      return {
        success: false,
        error: 'Erreur lors de la confirmation du paiement',
      }
    }
  }

  async createPaymentFromCart(cartId: string, referrer?: string): Promise<PaymentIntentResponse> {
    try {
      // 1. Détecter le domaine du store
      const storeDomain = await this.detectStoreDomain(cartId, referrer)
      console.log(`🏪 Domaine détecté: ${storeDomain}`)
      // 2. Récupérer le store par domaine
      const store = await this.storeService.getStoreByDomain(storeDomain)
      if (!store) throw new Error(`Store avec domaine ${storeDomain} non trouvé`)

      // 3. Récupérer les données du panier Shopify (obligatoire)
      if (!cartId.startsWith('gid://shopify/Cart/')) throw new Error('Seuls les paniers Shopify sont supportés')
      const shopifyId = getShopifyId(store);
      if (!shopifyId) throw new Error('Store is not a Shopify store');

      const cartData = await this.shopifyService.getShopifyCart(cartId, shopifyId)
      if (!cartData) throw new Error('Impossible de récupérer les données du panier')
      const totalAmountCents = Math.round(cartData.totalAmount * 100)

      // 4. Récupérer le checkoutId à partir du cartId pour la sélection déterministe des PSP
      const checkout = await this.prisma.checkout.findFirst({
        where: { 
          cartId: cartId,
          storeId: store.id
        },
        select: { id: true }
      })
      const checkoutId = checkout?.id

      // Vérifier la limite de 2 échecs consécutifs si un checkout existe
      if (checkoutId) {
        const hasReachedLimit = await this.hasReachedMaxConsecutiveFailures(checkoutId)
        if (hasReachedLimit) {
          console.log(`🚫 Limite de 2 échecs consécutifs atteinte pour le checkout ${checkoutId}`)
          return {
            success: false,
            error: 'Trop de tentatives de paiement échouées. Veuillez contacter le support.',
          }
        }
      }

      console.log(`🏪 Store: ${store.name} (${store.domain}) - Montant: ${cartData.totalAmount} ${cartData.currency}`)

      // 5. Routing config et cascade
      const config = await this.getRoutingConfigOrDefault(store.id)
      const attempted: string[] = []

      // En mode AUTOMATIC : pas de fallback (maxAttempts = 1)
      // En mode MANUAL : fallback activé si configuré
      const maxAttempts = config.mode === RoutingMode.AUTOMATIC
        ? 1
        : (1 + (config.fallbackEnabled ? config.maxRetries : 0))

      let attemptNumber = 1
      let lastError: any = null

      while (attemptNumber <= maxAttempts) {
        const selectedPSP = await this.selectNextPsp(store.id, totalAmountCents, cartData.currency || 'EUR', attempted, checkoutId)
        if (!selectedPSP) break
        const start = Date.now()

        console.log(`💳 PSP sélectionné: ${selectedPSP.psp.name} (${selectedPSP.psp.pspType}) - Tentative ${attemptNumber}/${maxAttempts}`)

        try {
          const stripe = this.createStripeInstance(selectedPSP.psp.secretKey)
          const customer = await stripe.customers.create({})
          const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmountCents,
            currency: cartData.currency.toLowerCase(),
            // payment_method_types: ['card', 'paypal', 'klarna'],
            automatic_payment_methods: {
              enabled: true,
            },
            customer: customer.id,
            setup_future_usage: 'off_session',
            // Plus besoin de métadonnées - toutes les données sont dans pspMetadata
          })

          // Enregistrer tentative PENDING avec toutes les données du panier dans pspMetadata
          await this.recordAttemptRow({
            orderId: null,
            storeId: store.id,
            pspId: selectedPSP.psp.id,
            pspIntentId: paymentIntent.id,
            amount: totalAmountCents,
            currency: cartData.currency.toUpperCase(),
            status: PaymentStatus.PENDING,
            pspMetadata: {
              cartId: cartData.id,
              storeDomain: storeDomain,
              pspType: selectedPSP.psp.pspType,
              storeId: store.id,
              customerId: customer.id,
              // Stocker les données du panier ici au lieu des métadonnées Stripe
              cartData: this.cleanCartDataForStorage(cartData)
            },
            attemptNumber,
            isFallback: attemptNumber > 1,
            processingTimeMs: Date.now() - start,
          })

          console.log(`✅ Payment Intent créé avec succès via ${selectedPSP.psp.name} - ID: ${paymentIntent.id}`)

          // Envoyer événement InitiateCheckout à Meta (non bloquant)
          this.sendMetaInitiateCheckout(store.id, cartData).catch(() => {});

          return {
            success: true,
            clientSecret: paymentIntent.client_secret || undefined,
            paymentIntentId: paymentIntent.id,
            publishableKey: selectedPSP.psp.publicKey,
          }
        } catch (e) {
          lastError = e
          console.log(`❌ Échec PSP ${selectedPSP.psp.name}: ${(e as any)?.message || 'Erreur inconnue'}`)
          await this.recordAttemptRow({
            orderId: null,
            storeId: store.id,
            pspId: selectedPSP.psp.id,
            amount: totalAmountCents,
            currency: cartData.currency.toUpperCase(),
            status: PaymentStatus.FAILED,
            pspMetadata: { cartId: cartData.id, storeDomain: storeDomain, storeId: store.id },
            failureReason: (e as any)?.message || 'creation_failed',
            attemptNumber,
            isFallback: attemptNumber > 1,
            processingTimeMs: Date.now() - start,
          })
          attempted.push(selectedPSP.psp.id)
          attemptNumber += 1
          continue
        }
      }

      return { success: false, error: 'Impossible de créer le paiement depuis le panier' }
    } catch (error) {
      console.error('Erreur lors de la création du Payment Intent depuis le panier:', error)
      return { success: false, error: `Erreur: ${error.message || 'Impossible de créer le paiement depuis le panier'}` }
    }
  }

  /**
   * Vérifie le nombre d'échecs consécutifs pour un checkout
   * Retourne true si 2 échecs consécutifs ou plus sont détectés
   * Ignore les paiements PENDING et PROCESSING dans le comptage
   */
  private async hasReachedMaxConsecutiveFailures(checkoutId: string): Promise<boolean> {
    const MAX_CONSECUTIVE_FAILURES = 2

    // Récupérer les paiements pour ce checkout, triés par date décroissante
    // On prend plus de paiements pour s'assurer de trouver les statuts finaux (SUCCESS/FAILED)
    const payments = await this.prisma.payment.findMany({
      where: {
        checkoutId: checkoutId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10, // Prendre assez de paiements pour trouver les statuts finaux
    })

    // Compter les échecs consécutifs depuis le plus récent
    // On ignore les paiements PENDING et PROCESSING dans le comptage
    // MAIS : si le paiement le plus récent est PENDING/PROCESSING, on ne bloque pas
    // car il pourrait encore réussir
    let consecutiveFailures = 0
    let mostRecentIsPendingOrProcessing = false

    if (payments.length > 0) {
      const mostRecent = payments[0]
      if (mostRecent.status === PaymentStatus.PENDING || mostRecent.status === PaymentStatus.PROCESSING) {
        mostRecentIsPendingOrProcessing = true
      }
    }

    for (const payment of payments) {
      if (payment.status === PaymentStatus.FAILED) {
        consecutiveFailures++
        // Si on atteint la limite ET qu'il n'y a pas de paiement en cours, on bloque
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && !mostRecentIsPendingOrProcessing) {
          return true
        }
      } else if (payment.status === PaymentStatus.SUCCESS) {
        // Si on trouve un succès, on arrête le comptage (pas de limite atteinte)
        break
      }
      // Pour PENDING ou PROCESSING (sauf le plus récent), on ignore et on continue
    }

    // Ne pas bloquer si le paiement le plus récent est en cours (pourrait réussir)
    if (mostRecentIsPendingOrProcessing) {
      return false
    }

    return consecutiveFailures >= MAX_CONSECUTIVE_FAILURES
  }

  async createPaymentFromCheckout(
    checkoutId: string,
    referrer?: string,
    customerData?: {
      email?: string;
      name?: string;
      phone?: string;
      address?: {
        line1?: string;
        line2?: string;
        city?: string;
        postal_code?: string;
        country?: string;
        state?: string;
      };
    },
    isExpressCheckout?: boolean
  ): Promise<PaymentIntentResponse> {
    try {
      // 1. Récupérer le checkout depuis notre base de données
      const checkout = await this.prisma.checkout.findUnique({
        where: { id: checkoutId },
        include: {
          store: true,
        },
      })

      if (!checkout) {
        throw new Error('Checkout non trouvé')
      }

      // Vérifier si le checkout n'a pas expiré
      if (checkout.expiresAt < new Date()) {
        // Marquer comme expiré
        await this.prisma.checkout.update({
          where: { id: checkoutId },
          data: { status: 'EXPIRED' },
        })
        throw new Error('Checkout expiré')
      }

      // Vérifier la limite de 2 échecs consécutifs
      const hasReachedLimit = await this.hasReachedMaxConsecutiveFailures(checkoutId)
      if (hasReachedLimit) {
        console.log(`🚫 Limite de 2 échecs consécutifs atteinte pour le checkout ${checkoutId}`)
        return {
          success: false,
          error: 'Trop de tentatives de paiement échouées. Veuillez contacter le support.',
        }
      }

      // 2. Extraire les données du panier depuis cartData
      const cartData = checkout.cartData as any
      const totalAmountCents = Math.round(cartData.totalAmount * 100)

      console.log(`🏪 Store: ${checkout.store.name} (${checkout.store.domain}) - Montant: ${cartData.totalAmount} ${cartData.currency}`)

      // 3. Vérifier la limite de 100€ pour protéger les comptes Stripe
      const MAX_CART_AMOUNT = 100 // euros
      if (cartData.totalAmount > MAX_CART_AMOUNT) {
        console.log(`⚠️ Panier trop élevé: ${cartData.totalAmount}€ > ${MAX_CART_AMOUNT}€`)

        // Calculer quels items on pourrait enlever pour retomber sous 100€
        const items = cartData.items as Array<{ id: string; name: string; quantity: number; unitPrice: number; totalPrice: number }>
        const suggestions = this.calculateItemsToRemove(items, cartData.totalAmount, MAX_CART_AMOUNT)

        if (suggestions.possible) {
          return {
            success: false,
            error: 'CART_AMOUNT_EXCEEDED',
            cartLimitExceeded: {
              currentAmount: cartData.totalAmount,
              maxAmount: MAX_CART_AMOUNT,
              currency: cartData.currency,
              suggestions: suggestions.itemsToRemove,
              newTotalAfterRemoval: suggestions.newTotal
            }
          }
        } else {
          // Impossible de proposer une solution (ex: un seul item à +100€)
          return {
            success: false,
            error: 'CART_AMOUNT_EXCEEDED',
            cartLimitExceeded: {
              currentAmount: cartData.totalAmount,
              maxAmount: MAX_CART_AMOUNT,
              currency: cartData.currency,
              suggestions: null,
              message: 'Le montant du panier dépasse la limite autorisée et aucun ajustement n\'est possible.'
            }
          }
        }
      }

      // 3. Routing config et cascade
      const config = await this.getRoutingConfigOrDefault(checkout.storeId)
      const attempted: string[] = []

      // En mode AUTOMATIC : pas de fallback (maxAttempts = 1)
      // En mode MANUAL : fallback activé si configuré
      const maxAttempts = config.mode === RoutingMode.AUTOMATIC
        ? 1
        : (1 + (config.fallbackEnabled ? config.maxRetries : 0))

      let attemptNumber = 1
      let lastError: any = null

      while (attemptNumber <= maxAttempts) {
        const selectedPSP = await this.selectNextPsp(checkout.storeId, totalAmountCents, cartData.currency || 'EUR', attempted, checkoutId)
        if (!selectedPSP) break
        const start = Date.now()

        console.log(`💳 PSP sélectionné: ${selectedPSP.psp.name} (${selectedPSP.psp.pspType}) - Tentative ${attemptNumber}/${maxAttempts}`)

        try {
          const stripe = this.createStripeInstance(selectedPSP.psp.secretKey)

          // Créer le Customer Stripe avec toutes les données disponibles pour améliorer le score Radar
          console.log('👤 Création du Customer Stripe avec données enrichies:', {
            email: customerData?.email,
            name: customerData?.name,
            hasAddress: !!customerData?.address?.line1
          })

          const customer = await stripe.customers.create({
            email: customerData?.email,
            name: customerData?.name,
            phone: customerData?.phone,
            address: customerData?.address ? {
              line1: customerData.address.line1,
              line2: customerData.address.line2,
              city: customerData.address.city,
              state: customerData.address.state,
              postal_code: customerData.address.postal_code,
              country: customerData.address.country,
            } : undefined,
          })

          // Préparer les données de shipping pour le PaymentIntent (si adresse disponible)
          const shippingData = customerData?.address?.line1 ? {
            name: customerData.name || 'N/A',
            address: {
              line1: customerData.address.line1,
              line2: customerData.address.line2 || undefined,
              city: customerData.address.city || '',
              state: customerData.address.state || '',
              postal_code: customerData.address.postal_code || '',
              country: customerData.address.country || '',
            }
          } : undefined

          const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmountCents,
            currency: cartData.currency.toLowerCase(),
            // payment_method_types: ['card', 'paypal', 'klarna'],
            automatic_payment_methods: {
              enabled: true,
            },
            customer: customer.id,
            // Pour Express Checkout (Apple Pay/Google Pay), pas de setup_future_usage ni shipping
            // car ExpressCheckoutElement gère ça côté client
            ...(isExpressCheckout ? {} : {
              setup_future_usage: 'off_session' as const,
              shipping: shippingData, // Données de livraison pour Radar (améliore le score de risque)
            }),
            metadata: {
              checkout_id: checkoutId,
            }
          })

          // Enregistrer tentative PENDING avec toutes les données du panier dans pspMetadata
          await this.recordAttemptRow({
            orderId: null,
            checkoutId: checkoutId,
            storeId: checkout.storeId,
            pspId: selectedPSP.psp.id,
            pspIntentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret || undefined,
            amount: totalAmountCents,
            currency: cartData.currency.toUpperCase(),
            status: PaymentStatus.PENDING,
            pspMetadata: {
              checkoutId: checkoutId,
              storeDomain: checkout.store.domain,
              pspType: selectedPSP.psp.pspType,
              storeId: checkout.storeId,
              customerId: customer.id,
              cartData: cartData,
              isExpressCheckout: isExpressCheckout || false,
            },
            attemptNumber,
            isFallback: attemptNumber > 1,
            processingTimeMs: Date.now() - start,
          })

          console.log(`✅ Payment Intent créé avec succès via ${selectedPSP.psp.name} - ID: ${paymentIntent.id}`)

          // Envoyer événement InitiateCheckout à Meta (non bloquant)
          this.sendMetaInitiateCheckout(checkout.storeId, cartData).catch(() => {});

          return {
            success: true,
            clientSecret: paymentIntent.client_secret || undefined,
            paymentIntentId: paymentIntent.id,
            publishableKey: selectedPSP.psp.publicKey,
          }
        } catch (e) {
          lastError = e
          console.log(`❌ Échec PSP ${selectedPSP.psp.name}: ${(e as any)?.message || 'Erreur inconnue'}`)
          await this.recordAttemptRow({
            orderId: null,
            checkoutId: checkoutId,
            storeId: checkout.storeId,
            pspId: selectedPSP.psp.id,
            amount: totalAmountCents,
            currency: cartData.currency.toUpperCase(),
            status: PaymentStatus.FAILED,
            pspMetadata: { checkoutId: checkoutId, storeDomain: checkout.store.domain, storeId: checkout.storeId },
            failureReason: (e as any)?.message || 'creation_failed',
            attemptNumber,
            isFallback: attemptNumber > 1,
            processingTimeMs: Date.now() - start,
          })
          attempted.push(selectedPSP.psp.id)
          attemptNumber += 1
          continue
        }
      }

      return { success: false, error: 'Impossible de créer le paiement depuis le checkout' }
    } catch (error) {
      console.error('Erreur lors de la création du Payment Intent depuis le checkout:', error)
      return { success: false, error: `Erreur: ${error.message || 'Impossible de créer le paiement depuis le checkout'}` }
    }
  }

  /**
   * Récupère uniquement la publishable key pour initialiser Stripe Elements
   * Sans créer de PaymentIntent dans Stripe
   */
  async getPublishableKeyForCheckout(checkoutId: string): Promise<{ success: boolean; publishableKey?: string; error?: string }> {
    try {
      // 1. Récupérer le checkout
      const checkout = await this.prisma.checkout.findUnique({
        where: { id: checkoutId },
        include: {
          store: true,
        },
      })

      if (!checkout) {
        return { success: false, error: 'Checkout non trouvé' }
      }

      // Vérifier si le checkout n'a pas expiré
      if (checkout.expiresAt < new Date()) {
        await this.prisma.checkout.update({
          where: { id: checkoutId },
          data: { status: 'EXPIRED' },
        })
        return { success: false, error: 'Checkout expiré' }
      }

      // 2. Vérifier si un PSP est déjà assigné au checkout (STICKY!)
      if (checkout.assignedPspId) {
        console.log(`🔑 PSP déjà assigné au checkout (sticky): ${checkout.assignedPspId}`)

        // Récupérer les informations du PSP pour la clé publique
        const psp = await this.prisma.psp.findUnique({
          where: { id: checkout.assignedPspId }
        })

        if (!psp) {
          return { success: false, error: 'PSP assigné non trouvé' }
        }

        // Déchiffrer la clé publique
        const decryptedCredentials = decryptPSPCredentials({
          publicKey: psp.publicKey,
          secretKey: psp.secretKey,
        })

        return {
          success: true,
          publishableKey: decryptedCredentials.publicKey,
        }
      }

      // 3. Si aucun PSP assigné, sélectionner un nouveau PSP et l'assigner au checkout
      console.log(`🆕 Aucun PSP assigné, sélection et assignation d'un nouveau PSP`)
      const cartData = checkout.cartData as any
      const totalAmountCents = Math.round(cartData.totalAmount * 100)
      const selectedPSP = await this.selectNextPsp(checkout.storeId, totalAmountCents, cartData.currency || 'EUR', [], checkoutId)

      if (!selectedPSP) {
        return { success: false, error: 'Aucun PSP disponible' }
      }

      console.log(`🔑 Nouveau PSP sélectionné et assigné: ${selectedPSP.psp.name}`)

      // Assigner le PSP au checkout pour le rendre sticky
      await this.prisma.checkout.update({
        where: { id: checkoutId },
        data: { assignedPspId: selectedPSP.psp.id }
      })

      // 4. Retourner uniquement la publishable key (déchiffrée)
      return {
        success: true,
        publishableKey: selectedPSP.psp.publicKey,
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de la publishable key:', error)
      return { success: false, error: 'Impossible de récupérer la clé publique' }
    }
  }

  async getOrCreatePaymentIntent(checkoutId: string): Promise<PaymentIntentResponse> {
    try {
      // 1. Vérifier s'il y a déjà un Payment Intent en cours pour ce checkout
      const existingPayment = await this.prisma.payment.findFirst({
        where: {
          checkoutId: checkoutId,
          status: PaymentStatus.PENDING,
          pspIntentId: { not: null }
        },
        orderBy: { createdAt: 'desc' }
      })

      if (existingPayment && existingPayment.pspIntentId) {
        console.log(`🔄 Payment Intent existant trouvé: ${existingPayment.pspIntentId}`)

        // Récupérer les informations du PSP pour la clé publique
        if (!existingPayment.pspId) {
          throw new Error('Existing payment has no PSP ID')
        }
        const psp = await this.prisma.psp.findUnique({
          where: { id: existingPayment.pspId }
        })

        if (!psp) {
          throw new Error('PSP non trouvé')
        }

        // Déchiffrer la clé publique
        const decryptedCredentials = decryptPSPCredentials({
          publicKey: psp.publicKey,
          secretKey: psp.secretKey,
        })

        return {
          success: true,
          clientSecret: existingPayment.clientSecret || undefined,
          paymentIntentId: existingPayment.pspIntentId,
          publishableKey: decryptedCredentials.publicKey,
        }
      }

      // 2. Si aucun Payment Intent PENDING, chercher le dernier Payment Intent valide (même FAILED)
      const lastValidPayment = await this.prisma.payment.findFirst({
        where: {
          checkoutId: checkoutId,
          pspIntentId: { not: null },
          clientSecret: { not: null }
        },
        orderBy: { createdAt: 'desc' }
      })

      if (lastValidPayment && lastValidPayment.pspIntentId && lastValidPayment.clientSecret) {
        console.log(`🔄 Dernier Payment Intent valide trouvé: ${lastValidPayment.pspIntentId} (statut: ${lastValidPayment.status})`)

        // Récupérer les informations du PSP pour la clé publique
        if (!lastValidPayment.pspId) {
          throw new Error('Last valid payment has no PSP ID')
        }
        const psp = await this.prisma.psp.findUnique({
          where: { id: lastValidPayment.pspId }
        })

        if (!psp) {
          throw new Error('PSP non trouvé')
        }

        // Déchiffrer la clé publique
        const decryptedCredentials = decryptPSPCredentials({
          publicKey: psp.publicKey,
          secretKey: psp.secretKey,
        })

        return {
          success: true,
          clientSecret: lastValidPayment.clientSecret,
          paymentIntentId: lastValidPayment.pspIntentId,
          publishableKey: decryptedCredentials.publicKey,
        }
      }

      // 3. Si aucun Payment Intent valide, en créer un nouveau
      console.log(`🆕 Aucun Payment Intent valide trouvé, création d'un nouveau`)
      return await this.createPaymentFromCheckout(checkoutId)
    } catch (error) {
      console.error('Erreur lors de la récupération/création du Payment Intent:', error)
      return { success: false, error: 'Impossible de récupérer ou créer le Payment Intent' }
    }
  }

  async getOrderByPaymentIntent(paymentIntentId: string) {
    try {
      // Récupérer l'enregistrement de paiement avec toutes les relations nécessaires
      const paymentRecord = await this.prisma.payment.findFirst({
        where: { pspIntentId: paymentIntentId },
        include: { 
          order: {
            include: {
              items: true,
              store: true
            }
          }
        }
      })

      if (!paymentRecord) {
        return {
          success: false,
          error: 'Commande non trouvée - le paiement n\'a peut-être pas encore été confirmé'
        }
      }

      const order = paymentRecord.order
      
      if (!order) {
        return {
          success: false,
          error: 'Ordre non trouvé - le paiement n\'a pas encore été confirmé'
        }
      }
      
      // Récupérer le PSP pour obtenir les détails du paiement
      const storePSPs = await this.pspService.getStorePSPs(paymentRecord.order?.store?.id || '')
      const selectedPSP = storePSPs.find(sp => sp.psp.id === paymentRecord.pspId)
      if (!selectedPSP) {
        return {
          success: false,
          error: 'PSP non trouvé'
        }
      }
      
      const stripeInstance = this.createStripeInstance(selectedPSP.psp.secretKey)
      const paymentIntent = await stripeInstance.paymentIntents.retrieve(paymentIntentId)
      
      // Extraire les données client depuis l'ordre (metadata) et/ou le Customer Stripe
      let customerData = null
      
      // D'abord essayer depuis les metadata de l'ordre
      if (order.metadata && typeof order.metadata === 'object') {
        const metadata = order.metadata as any
        customerData = {
          email: order.customerEmail,
          name: metadata.customerName,
          phone: metadata.customerPhone,
          address: metadata.shippingAddress || metadata.billingAddress
        }
      }
      
      // Si pas de données dans les metadata, essayer le Customer Stripe (fallback)
      if (!customerData && paymentIntent.customer) {
        try {
          const customer = await stripeInstance.customers.retrieve(paymentIntent.customer as string)
          if (customer && !customer.deleted) {
            customerData = {
              email: customer.email || order.customerEmail,
              name: customer.name,
              phone: customer.phone,
              address: customer.address
            }
          }
        } catch (error) {
          console.warn('Impossible de récupérer les données client depuis Stripe:', error)
        }
      }
      
      // Fallback minimal avec juste l'email de l'ordre
      if (!customerData) {
        customerData = {
          email: order.customerEmail,
          name: null,
          phone: null,
          address: null
        }
      }

      // Formater les données pour la page de remerciement
      const orderData = {
        confirmationNumber: paymentIntent.id.slice(-8).toUpperCase(),
        customerEmail: customerData?.email || order.customerEmail,
        shippingAddress: {
          name: customerData?.name || 'Client',
          address: customerData?.address?.line1 || 'Adresse non fournie',
          line2: customerData?.address?.line2 || '',
          city: customerData?.address?.city || 'Ville non fournie',
          postalCode: customerData?.address?.postal_code || '',
          country: customerData?.address?.country || 'Pays non fourni'
        },
        billingAddress: {
          name: customerData?.name || 'Client',
          address: customerData?.address?.line1 || 'Adresse non fournie',
          line2: customerData?.address?.line2 || '',
          city: customerData?.address?.city || 'Ville non fournie',
          postalCode: customerData?.address?.postal_code || '',
          country: customerData?.address?.country || 'Pays non fourni'
        },
        shippingMethod: 'Standard',
        items: order.items.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description || '',
          quantity: item.quantity,
          price: item.unitPrice / 100, // Convertir de centimes en euros
          image: item.image
        })),
        pricing: {
          subtotal: order.subtotal / 100,
          shipping: order.shippingCost / 100,
          total: order.totalAmount / 100,
          currency: order.currency.toUpperCase()
        },
        store: {
          name: order.store.name,
          domain: order.store.domain,
          requiresShipping: order.store.requiresShipping
        },
        paymentStatus: paymentRecord.status,
        createdAt: order.createdAt
      }

      return {
        success: true,
        order: orderData
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de la commande:', error)
      return {
        success: false,
        error: 'Erreur lors de la récupération des données de commande'
      }
    }
  }

  /**
   * Préparer le paiement WooCommerce - Retourne la clé publique du meilleur PSP
   * Retourne un ID opaque pour identifier la session de paiement
   */
  async prepareWooCommercePayment(
    domain: string
  ): Promise<{ success: boolean; publishableKey?: string; id?: string; error?: string }> {
    try {
      // 1. Récupérer le store via son domaine
      const store = await this.prisma.store.findUnique({
        where: { domain: domain }
      });

      if (!store) {
        return {
          success: false,
          error: `Store non trouvé pour le domaine: ${domain}. Veuillez ajouter votre boutique dans le dashboard HeyPay.`
        };
      }

      const storeId = store.id;

      // 2. Sélectionner le meilleur PSP (celui avec la plus grande capacité)
      // On utilise un montant symbolique de 1000 cents (10€) juste pour la sélection
      const selectedPSP = await this.selectNextPsp(storeId, 1000, 'EUR', [], `prepare_${Date.now()}`);

      if (!selectedPSP) {
        return {
          success: false,
          error: 'Aucun PSP disponible pour traiter ce paiement'
        };
      }

      console.log(`✅ PSP sélectionné pour préparation: ${selectedPSP.psp.name} (${selectedPSP.psp.id})`);

      // Les clés sont déjà décryptées dans DecryptedStorePSP
      return {
        success: true,
        publishableKey: selectedPSP.psp.publicKey, // Déjà décrypté (pk_test_...)
        id: selectedPSP.psp.id // ID opaque pour le frontend
      };

    } catch (e) {
      console.error('❌ Erreur lors de la préparation du paiement:', e);
      return {
        success: false,
        error: (e as any)?.message || 'Erreur inconnue'
      };
    }
  }

  /**
   * Créer un PaymentIntent pour WooCommerce avec le PSP sélectionné
   */
  async createWooCommercePaymentIntent(
    domain: string,
    amount: number,
    currency: string,
    orderId: string,
    customerEmail?: string,
    paymentMethod?: string,
    pspId?: string // ID du PSP sélectionné lors du prepare
  ): Promise<PaymentIntentResponse> {
    try {
      // 1. Récupérer le store via son domaine
      const store = await this.prisma.store.findUnique({
        where: { domain: domain }
      });

      if (!store) {
        return {
          success: false,
          error: `Store non trouvé pour le domaine: ${domain}. Veuillez ajouter votre boutique dans le dashboard HeyPay.`
        };
      }

      const storeId = store.id;
      const amountCents = Math.round(amount * 100);

      // 2. Créer ou récupérer le Checkout pour le tracking analytics
      const cartId = `woo_${orderId}`; // Préfixe pour identifier les ordres WooCommerce
      let checkout = await this.prisma.checkout.findFirst({
        where: {
          cartId: cartId,
          storeId: storeId,
        }
      });

      let isNewCheckout = false;
      if (!checkout) {
        // Créer un nouveau checkout pour cet ordre WooCommerce
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        checkout = await this.prisma.checkout.create({
          data: {
            id: `woo_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            storeId: storeId,
            cartId: cartId,
            cartData: {
              platform: 'woocommerce',
              orderId: orderId,
              totalAmount: amount,
              currency: currency,
              customerEmail: customerEmail,
            },
            status: 'PENDING',
            expiresAt: expiresAt,
          }
        });
        isNewCheckout = true;
        console.log(`🛒 Nouveau checkout créé pour WooCommerce: ${checkout.id} (ordre: ${orderId})`);

        // Enregistrer l'événement CHECKOUT_INITIATED
        await this.recordCheckoutEvent(checkout.id, 'CHECKOUT_INITIATED');
      } else {
        console.log(`🛒 Checkout existant récupéré: ${checkout.id} (ordre: ${orderId})`);
      }

      const checkoutId = checkout.id;

      // 3. Récupérer le PSP sélectionné
      if (!pspId) {
        return {
          success: false,
          error: 'PSP ID manquant. Veuillez appeler /payment/woocommerce/prepare d\'abord.'
        };
      }

      const psp = await this.prisma.psp.findUnique({
        where: { id: pspId }
      });

      if (!psp) {
        return {
          success: false,
          error: 'PSP non trouvé'
        };
      }

      // Décrypter les credentials
      const decryptedCredentials = decryptPSPCredentials({
        publicKey: psp.publicKey,
        secretKey: psp.secretKey,
      });

      // 3. Créer le PaymentIntent avec le PSP sélectionné
      // Pas de cascading - comme beatmanltd, on utilise uniquement le PSP préparé
      console.log(`💳 Utilisation du PSP: ${psp.name} pour WooCommerce`);

      const start = Date.now();
      let customerId: string | undefined; // Déclaré ici pour être accessible dans le catch

      try {
        const stripe = this.createStripeInstance(decryptedCredentials.secretKey);

        // Créer ou récupérer le Customer Stripe pour sauvegarder le payment method

        if (customerEmail) {
          // Chercher si un customer existe déjà avec cet email
          const existingCustomers = await stripe.customers.list({
            email: customerEmail,
            limit: 1
          });

          if (existingCustomers.data.length > 0) {
            customerId = existingCustomers.data[0].id;
            console.log(`🧑‍💼 Customer Stripe existant trouvé: ${customerId} (${customerEmail})`);
          } else {
            // Créer un nouveau Customer
            const customer = await stripe.customers.create({
              email: customerEmail,
            });
            customerId = customer.id;
            console.log(`🧑‍💼 Nouveau Customer Stripe créé: ${customerId} (${customerEmail})`);
          }
        } else {
          // Pas d'email fourni, créer un Customer anonyme pour pouvoir sauvegarder le PM
          const customer = await stripe.customers.create({});
          customerId = customer.id;
          console.log(`🧑‍💼 Customer Stripe anonyme créé: ${customerId}`);
        }

        // Enregistrer l'événement PAYMENT_ATTEMPTED
        await this.recordCheckoutEvent(checkoutId, 'PAYMENT_ATTEMPTED');

        // Créer le PaymentIntent avec confirm: true (comme FunnelKit)
        // Avec setup_future_usage pour sauvegarder le payment method
        const paymentIntentParams: any = {
          amount: amountCents,
          currency: currency.toLowerCase(),
          payment_method: paymentMethod,
          customer: customerId,
          confirm: true, // ✅ Confirmer immédiatement (comme FunnelKit)
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never' // ✅ Pas de méthodes avec redirect = pas besoin de return_url
          },
          setup_future_usage: 'off_session', // 💳 Sauvegarder le payment method pour rebilling
        };

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

        console.log(`🔍 PaymentIntent status: ${paymentIntent.status}`);
        console.log(`🔍 PaymentIntent requires_action: ${paymentIntent.status === 'requires_action'}`);

        // Déterminer le statut du paiement en fonction du statut Stripe
        let paymentStatus: PaymentStatus;
        if (paymentIntent.status === 'succeeded') {
          paymentStatus = PaymentStatus.SUCCESS;
        } else if (paymentIntent.status === 'requires_action' || paymentIntent.status === 'requires_payment_method') {
          paymentStatus = PaymentStatus.PENDING;
        } else {
          paymentStatus = PaymentStatus.PENDING;
        }

        // Enregistrer tentative avec le statut approprié
        await this.recordAttemptRow({
          orderId: null,
          checkoutId: checkoutId, // ✅ Associer au checkout pour analytics
          storeId: storeId,
          pspId: psp.id,
          pspIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret || undefined,
          amount: amountCents,
          currency: currency.toUpperCase(),
          status: paymentStatus,
          pspMetadata: {
            woocommerceOrderId: orderId,
            storeId: storeId,
            paymentMethod: paymentMethod,
            customerEmail: customerEmail,
            customerId: customerId, // Pour retrouver le Customer et ses payment methods lors du rebilling
          },
          attemptNumber: 1,
          isFallback: false,
          processingTimeMs: Date.now() - start,
        });

        // Note: L'usage PSP est maintenant calculé dynamiquement depuis les paiements (24h/30d glissant)

        console.log(`✅ Payment Intent créé avec succès via ${psp.name} - ID: ${paymentIntent.id}`);

        return {
          success: true,
          clientSecret: paymentIntent.client_secret || undefined,
          paymentIntentId: paymentIntent.id,
          publishableKey: decryptedCredentials.publicKey, // ✅ Use decrypted key (pk_test_...)
          status: paymentIntent.status, // Add status to check if 3DS is needed
        };
      } catch (e) {
        console.log(`❌ Échec création PaymentIntent: ${(e as any)?.message || 'Erreur inconnue'}`);

        // Enregistrer échec
        await this.recordAttemptRow({
          orderId: null,
          checkoutId: checkoutId, // ✅ Associer au checkout pour analytics
          storeId: storeId,
          pspId: psp.id,
          amount: amountCents,
          currency: currency.toUpperCase(),
          status: 'FAILED' as any,
          pspMetadata: { woocommerceOrderId: orderId, storeId: storeId, customerId: customerId },
          failureReason: (e as any)?.message || 'creation_failed',
          attemptNumber: 1,
          isFallback: false,
          processingTimeMs: Date.now() - start,
        });

        return {
          success: false,
          error: (e as any)?.message || 'Erreur lors de la création du PaymentIntent'
        };
      }
    } catch (error) {
      console.error('Erreur lors de la création du Payment Intent WooCommerce:', error);
      return {
        success: false,
        error: 'Erreur lors de la création du paiement'
      };
    }
  }

  async retryPayment(data: { previousPaymentIntentId: string; checkoutId: string; lastErrorCode?: string; storeId?: string; currency?: string; }) {
    try {
      // Récupérer le record précédent pour connaître le store et le PSP utilisé
      const prev = await this.prisma.payment.findFirst({
        where: { pspIntentId: data.previousPaymentIntentId }
      })
      if (!prev) {
        throw new Error('Tentative précédente introuvable')
      }

      // Déterminer le store
      let storeId = data.storeId
      if (!storeId) {
        // Essayer via metadata du Payment précédent (storeDomain)
        const storeDomain = (prev.pspMetadata as any)?.storeDomain
        if (storeDomain) {
          const store = await this.storeService.getStoreByDomain(storeDomain)
          if (!store) throw new Error('Store introuvable pour retry')
          storeId = store.id
        }
      }
      if (!storeId) throw new Error('Store non déterminé pour retry')

      // Récupérer le checkout depuis notre base de données
      const checkout = await this.prisma.checkout.findUnique({
        where: { id: data.checkoutId },
        include: {
          store: true,
        },
      })

      if (!checkout) {
        throw new Error('Checkout introuvable pour retry')
      }

      // Vérifier la limite de 2 échecs consécutifs
      const hasReachedLimit = await this.hasReachedMaxConsecutiveFailures(data.checkoutId)
      if (hasReachedLimit) {
        console.log(`🚫 Limite de 2 échecs consécutifs atteinte pour le checkout ${data.checkoutId}`)
        return {
          success: false,
          error: 'Trop de tentatives de paiement échouées. Veuillez contacter le support.',
        }
      }

      // Extraire les données du panier depuis cartData
      const cartData = checkout.cartData as any
      const amountCents = Math.round(cartData.totalAmount * 100)

      const config = await this.getRoutingConfigOrDefault(storeId)
      const attempted = prev.pspId ? [prev.pspId] : []

      // En mode AUTOMATIC : pas de fallback (maxAttempts = 1)
      // En mode MANUAL : fallback activé si configuré
      const maxAttempts = config.mode === RoutingMode.AUTOMATIC
        ? 1
        : (1 + (config.fallbackEnabled ? config.maxRetries : 0))

      let attemptNumber = (prev.attemptNumber || 1) + 1
      let lastError: any = null

      while (attemptNumber <= maxAttempts) {
        // Déterminer le prochain PSP disponible
        const next = await this.selectNextPsp(storeId, amountCents, cartData.currency || 'EUR', attempted, data.checkoutId)
        if (!next) {
          return { success: false, error: 'Aucun PSP disponible pour un retry' }
        }

        const start = Date.now()
        console.log(`💳 PSP sélectionné pour retry: ${next.psp.name} (${next.psp.pspType}) - Tentative ${attemptNumber}/${maxAttempts}`)

        try {
          const stripe = this.createStripeInstance(next.psp.secretKey)
          const customer = await stripe.customers.create({})
          const paymentIntent = await stripe.paymentIntents.create({
            amount: amountCents,
            currency: cartData.currency.toLowerCase(),
            // payment_method_types: ['card', 'paypal', 'klarna'],
            automatic_payment_methods: {
              enabled: true,
            },
            customer: customer.id,
            setup_future_usage: 'off_session',
          })

          await this.recordAttemptRow({
            orderId: null,
            checkoutId: data.checkoutId,
            storeId: storeId,
            pspId: next.psp.id,
            pspIntentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret || undefined,
            amount: amountCents,
            currency: cartData.currency.toUpperCase(),
            status: PaymentStatus.PENDING,
            pspMetadata: { 
              checkoutId: data.checkoutId, 
              storeId: storeId,
              storeDomain: checkout.store.domain,
              customerId: customer.id,
              cartData: cartData
            },
            attemptNumber,
            isFallback: true,
            processingTimeMs: Date.now() - start,
          })

          console.log(`✅ Payment Intent créé avec succès via ${next.psp.name} - ID: ${paymentIntent.id}`)

          return {
            success: true,
            clientSecret: paymentIntent.client_secret || undefined,
            paymentIntentId: paymentIntent.id,
            publishableKey: next.psp.publicKey,
          }
        } catch (e) {
          lastError = e
          console.log(`❌ Échec PSP ${next.psp.name}: ${(e as any)?.message || 'Erreur inconnue'}`)
          await this.recordAttemptRow({
            orderId: null,
            checkoutId: data.checkoutId,
            storeId: storeId,
            pspId: next.psp.id,
            amount: amountCents,
            currency: cartData.currency.toUpperCase(),
            status: PaymentStatus.FAILED,
            pspMetadata: { checkoutId: data.checkoutId, storeId: storeId, storeDomain: checkout.store.domain },
            failureReason: (e as any)?.message || 'creation_failed',
            attemptNumber,
            isFallback: true,
            processingTimeMs: Date.now() - start,
          })
          attempted.push(next.psp.id)
          attemptNumber += 1
          continue
        }
      }

      return { success: false, error: 'Impossible de relancer le paiement après tous les essais' }
    } catch (error) {
      console.error('Erreur lors du retry de paiement:', error)
      return { success: false, error: 'Impossible de relancer le paiement' }
    }
  }

  /**
   * Effectuer un rebilling off-session avec un payment method sauvegardé
   * @param customerEmail Email du client pour retrouver le Customer Stripe
   * @param amount Montant en euros/dollars
   * @param currency Devise (EUR, USD, etc.)
   * @param storeId ID du store
   * @param orderId ID de la commande WooCommerce
   * @returns Résultat du paiement
   */
  async chargeOffSession(
    customerEmail: string,
    amount: number,
    currency: string,
    storeId: string,
    orderId?: string
  ): Promise<{ success: boolean; paymentIntentId?: string; error?: string }> {
    try {
      // 1. Récupérer le store pour avoir accès au PSP
      const store = await this.prisma.store.findUnique({
        where: { id: storeId }
      });

      if (!store) {
        return { success: false, error: 'Store non trouvé' };
      }

      // 2. Sélectionner le meilleur PSP
      const amountCents = Math.round(amount * 100);
      const selectedPSP = await this.selectNextPsp(storeId, amountCents, currency, [], `rebill_${Date.now()}`);

      if (!selectedPSP) {
        return { success: false, error: 'Aucun PSP disponible' };
      }

      console.log(`💳 PSP sélectionné pour rebilling: ${selectedPSP.psp.name}`);

      const stripe = this.createStripeInstance(selectedPSP.psp.secretKey);

      // 3. Retrouver le Customer Stripe par email
      const existingCustomers = await stripe.customers.list({
        email: customerEmail,
        limit: 1
      });

      if (existingCustomers.data.length === 0) {
        return {
          success: false,
          error: `Aucun Customer Stripe trouvé pour l'email: ${customerEmail}`
        };
      }

      const customer = existingCustomers.data[0];
      console.log(`🧑‍💼 Customer Stripe trouvé: ${customer.id} (${customerEmail})`);

      // 4. Récupérer le payment method par défaut du customer
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customer.id,
        type: 'card',
        limit: 1
      });

      if (paymentMethods.data.length === 0) {
        return {
          success: false,
          error: `Aucun payment method sauvegardé pour le customer: ${customerEmail}`
        };
      }

      const paymentMethod = paymentMethods.data[0];
      console.log(`💳 Payment method trouvé: ${paymentMethod.id}`);

      // 5. Créer le PaymentIntent off-session avec confirmation automatique
      const start = Date.now();

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountCents,
          currency: currency.toLowerCase(),
          customer: customer.id,
          payment_method: paymentMethod.id,
          off_session: true, // 🔑 Important pour le rebilling automatique
          confirm: true, // Confirmer immédiatement
        });

        console.log(`✅ Rebilling réussi: ${paymentIntent.id} - Statut: ${paymentIntent.status}`);

        // 6. Enregistrer le paiement
        await this.recordAttemptRow({
          orderId: null,
          storeId: storeId,
          pspId: selectedPSP.psp.id,
          pspIntentId: paymentIntent.id,
          amount: amountCents,
          currency: currency.toUpperCase(),
          status: paymentIntent.status === 'succeeded' ? PaymentStatus.SUCCESS : PaymentStatus.PENDING,
          pspMetadata: {
            woocommerceOrderId: orderId || 'rebill',
            storeId: storeId,
            customerId: customer.id,
            customerEmail: customerEmail,
            paymentMethod: paymentMethod.id,
            rebilling: true
          },
          attemptNumber: 1,
          isFallback: false,
          processingTimeMs: Date.now() - start,
        });

        // Note: L'usage PSP est maintenant calculé dynamiquement depuis les paiements (24h/30d glissant)

        return {
          success: paymentIntent.status === 'succeeded',
          paymentIntentId: paymentIntent.id,
          error: paymentIntent.status !== 'succeeded' ? `Statut: ${paymentIntent.status}` : undefined
        };

      } catch (e) {
        console.error(`❌ Échec rebilling: ${(e as any)?.message}`);

        // Enregistrer l'échec
        await this.recordAttemptRow({
          orderId: null,
          storeId: storeId,
          pspId: selectedPSP.psp.id,
          amount: amountCents,
          currency: currency.toUpperCase(),
          status: PaymentStatus.FAILED,
          pspMetadata: {
            woocommerceOrderId: orderId || 'rebill',
            storeId: storeId,
            customerId: customer.id,
            rebilling: true
          },
          failureReason: (e as any)?.message || 'rebilling_failed',
          attemptNumber: 1,
          isFallback: false,
          processingTimeMs: Date.now() - start,
        });

        return {
          success: false,
          error: (e as any)?.message || 'Échec du rebilling'
        };
      }

    } catch (error) {
      console.error('Erreur lors du rebilling off-session:', error);
      return {
        success: false,
        error: 'Erreur lors du rebilling'
      };
    }
  }

  /**
   * Calcule quels items enlever du panier pour retomber sous la limite
   * Algorithme glouton : on enlève les items les moins chers d'abord (pour garder le max de valeur)
   * mais si ça ne suffit pas, on essaie d'enlever les plus chers
   */
  private calculateItemsToRemove(
    items: Array<{ id: string; name: string; quantity: number; unitPrice: number; totalPrice: number }>,
    currentTotal: number,
    maxAmount: number
  ): { possible: boolean; itemsToRemove: Array<{ id: string; name: string; quantity: number; unitPrice: number }>; newTotal: number } {
    const amountToRemove = currentTotal - maxAmount

    // Si un seul item et il dépasse déjà la limite, impossible
    if (items.length === 1 && items[0].totalPrice > maxAmount) {
      return { possible: false, itemsToRemove: [], newTotal: currentTotal }
    }

    // Créer une liste plate d'items individuels (si quantity > 1, on les sépare)
    const flatItems: Array<{ id: string; name: string; unitPrice: number; originalItem: typeof items[0] }> = []
    for (const item of items) {
      for (let i = 0; i < item.quantity; i++) {
        flatItems.push({
          id: item.id,
          name: item.name,
          unitPrice: item.unitPrice,
          originalItem: item
        })
      }
    }

    // Trier par prix croissant (enlever les moins chers d'abord pour garder le max de valeur)
    flatItems.sort((a, b) => a.unitPrice - b.unitPrice)

    let removedTotal = 0
    const itemsToRemove: Map<string, { id: string; name: string; quantity: number; unitPrice: number }> = new Map()

    // Enlever des items jusqu'à ce qu'on soit sous la limite
    for (const item of flatItems) {
      if (removedTotal >= amountToRemove) break

      // Ne pas tout enlever - garder au moins un item
      const remainingValue = currentTotal - removedTotal - item.unitPrice
      if (remainingValue <= 0) continue

      removedTotal += item.unitPrice

      const existing = itemsToRemove.get(item.id)
      if (existing) {
        existing.quantity += 1
      } else {
        itemsToRemove.set(item.id, {
          id: item.id,
          name: item.name,
          quantity: 1,
          unitPrice: item.unitPrice
        })
      }
    }

    const newTotal = currentTotal - removedTotal

    // Vérifier si on a réussi à passer sous la limite
    if (newTotal <= maxAmount && newTotal > 0) {
      return {
        possible: true,
        itemsToRemove: Array.from(itemsToRemove.values()),
        newTotal
      }
    }

    // Si ça n'a pas marché avec les moins chers, essayer avec les plus chers
    flatItems.sort((a, b) => b.unitPrice - a.unitPrice)
    itemsToRemove.clear()
    removedTotal = 0

    for (const item of flatItems) {
      if (removedTotal >= amountToRemove) break

      const remainingValue = currentTotal - removedTotal - item.unitPrice
      if (remainingValue <= 0) continue

      removedTotal += item.unitPrice

      const existing = itemsToRemove.get(item.id)
      if (existing) {
        existing.quantity += 1
      } else {
        itemsToRemove.set(item.id, {
          id: item.id,
          name: item.name,
          quantity: 1,
          unitPrice: item.unitPrice
        })
      }
    }

    const finalTotal = currentTotal - removedTotal

    if (finalTotal <= maxAmount && finalTotal > 0) {
      return {
        possible: true,
        itemsToRemove: Array.from(itemsToRemove.values()),
        newTotal: finalTotal
      }
    }

    return { possible: false, itemsToRemove: [], newTotal: currentTotal }
  }


}

// Utils locaux
function weightedPick<T extends { sp: DecryptedStorePSP; weight: number }>(items: T[], checkoutId?: string): DecryptedStorePSP | null {
  const valid = items.filter(i => i.weight > 0)
  if (valid.length === 0) return items.length ? items[0].sp : null
  
  const total = valid.reduce((acc, i) => acc + i.weight, 0)
  
  // Si on a un checkoutId, utiliser un générateur déterministe
  if (checkoutId) {
    // Créer un hash simple du checkoutId pour servir de seed
    let hash = 0
    for (let i = 0; i < checkoutId.length; i++) {
      const char = checkoutId.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    // Utiliser le hash comme seed pour un générateur pseudo-aléatoire
    const seed = Math.abs(hash)
    const r = (seed % 1000) / 1000 * total // Valeur entre 0 et total
    let cum = 0
    for (const i of valid) {
      cum += i.weight
      if (r <= cum) return i.sp
    }
    return valid[valid.length - 1].sp
  }
  
  // Fallback: sélection aléatoire si pas de checkoutId
  const r = Math.random() * total
  let cum = 0
  for (const i of valid) {
    cum += i.weight
    if (r <= cum) return i.sp
  }
  return valid[valid.length - 1].sp
}

function monthlyCapSafe(v: number) { return v <= 0 ? 1 : v }

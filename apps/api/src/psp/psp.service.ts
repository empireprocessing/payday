import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { DecryptedStorePSP, CreatePSPDto, UpdatePSPCredentialsDto, PSPWithStoreCount } from './interfaces/psp.interface'
import { decryptPSPCredentials, encryptPSPCredentials } from '../common/encryption'
import { getBusinessDayStartUTC } from '../common/business-day'
import Stripe from 'stripe'

@Injectable()
export class PspService {
  constructor(private prisma: PrismaService) {}

  // Récupérer les PSPs d'une boutique (avec déchiffrement)
  async getStorePSPs(storeId: string): Promise<DecryptedStorePSP[]> {
    const storePSPs = await this.prisma.storePSP.findMany({
      where: {
        storeId,
        psp: {
          isActive: true,
        },
      },
      include: {
        psp: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    // Déchiffrer les credentials de chaque PSP
    return storePSPs.map(storePSP => {
      try {
        const decryptedCredentials = decryptPSPCredentials({
          publicKey: storePSP.psp.publicKey,
          secretKey: storePSP.psp.secretKey,
        })

        return {
          ...storePSP,
          psp: {
            ...storePSP.psp,
            publicKey: decryptedCredentials.publicKey,
            secretKey: decryptedCredentials.secretKey,
          }
        }
      } catch (error) {
        console.error(`❌ Erreur de déchiffrement pour PSP ${storePSP.psp.id}:`, error.message)
        throw new Error(`Impossible de déchiffrer les credentials du PSP ${storePSP.psp.id}`)
      }
    })
  }

  // Récupérer un StorePSP spécifique avec déchiffrement
  async getStorePSP(storePspId: string): Promise<DecryptedStorePSP | null> {
    const storePSP = await this.prisma.storePSP.findUnique({
      where: { id: storePspId },
      include: {
        psp: true,
      },
    })

    if (!storePSP) return null

    const decryptedCredentials = decryptPSPCredentials({
      publicKey: storePSP.psp.publicKey,
      secretKey: storePSP.psp.secretKey,
    })

    return {
      ...storePSP,
      psp: {
        ...storePSP.psp,
        publicKey: decryptedCredentials.publicKey,
        secretKey: decryptedCredentials.secretKey,
      }
    }
  }

  // Créer un nouveau PSP global
  async createPSP(data: CreatePSPDto) {
    // Chiffrer les credentials avant stockage
    const encryptedCredentials = encryptPSPCredentials({
      publicKey: data.publicKey,
      secretKey: data.secretKey,
    })

    return await this.prisma.psp.create({
      data: {
        name: data.name,
        pspType: data.pspType,
        publicKey: encryptedCredentials.publicKey,
        secretKey: encryptedCredentials.secretKey,
        monthlyCapacityEur: data.monthlyCapacityEur,
        dailyCapacityEur: data.dailyCapacityEur,
        config: data.config,
      },
    })
  }

  // Lier un PSP à une boutique
  async linkPSPToStore(storeId: string, pspId: string) {
    // Vérifier que la liaison n'existe pas déjà
    const existing = await this.prisma.storePSP.findUnique({
      where: {
        storeId_pspId: { storeId, pspId }
      }
    });

    if (existing) {
      throw new Error('Ce PSP est déjà lié à cette boutique');
    }

    return await this.prisma.storePSP.create({
      data: {
        storeId,
        pspId,
      },
      include: {
        psp: true,
        store: true,
      }
    });
  }

  // Mettre à jour les credentials d'un PSP (avec chiffrement)
  async updatePSPCredentials(pspId: string, credentials: UpdatePSPCredentialsDto) {
    const updateData: any = {}

    if (credentials.publicKey) {
      const encrypted = encryptPSPCredentials({
        publicKey: credentials.publicKey,
        secretKey: 'temp', // Temporary pour le chiffrement
      })
      updateData.publicKey = encrypted.publicKey
    }

    if (credentials.secretKey) {
      const encrypted = encryptPSPCredentials({
        publicKey: 'temp', // Temporary pour le chiffrement
        secretKey: credentials.secretKey,
      })
      updateData.secretKey = encrypted.secretKey
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('Aucune credential à mettre à jour')
    }

    return await this.prisma.psp.update({
      where: { id: pspId },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    })
  }

  // Récupérer tous les PSP globaux avec le nombre de stores connectés et usage jour ouvrable
  async getAllPSPs(): Promise<PSPWithStoreCount[]> {
    const psps = await this.prisma.psp.findMany({
      orderBy: { createdAt: 'desc' },
    })

    const sinceBusinessDay = getBusinessDayStartUTC()
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Pour chaque PSP, compter le nombre de stores connectés et calculer l'usage
    const pspsWithStoreCount = await Promise.all(
      psps.map(async (psp) => {
        const [storeCount, usageBusinessDay, usage30d] = await Promise.all([
          this.prisma.storePSP.count({
            where: { pspId: psp.id }
          }),
          this.prisma.payment.aggregate({
            where: {
              pspId: psp.id,
              status: 'SUCCESS',
              createdAt: { gte: sinceBusinessDay },
            },
            _sum: { amount: true },
          }),
          this.prisma.payment.aggregate({
            where: {
              pspId: psp.id,
              status: 'SUCCESS',
              createdAt: { gte: since30d },
            },
            _sum: { amount: true },
          }),
        ])

        const result = {
          ...psp,
          connectedStores: storeCount,
          // Usage jour ouvrable (depuis 6h Paris) et 30 jours
          usageBusinessDay: usageBusinessDay._sum.amount || 0,
          usage30d: usage30d._sum.amount || 0,
        }

        return result
      })
    )

    return pspsWithStoreCount
  }

  // Récupérer un PSP par ID (sans déchiffrement pour la liste)
  async getPSPById(pspId: string) {
    return await this.prisma.psp.findUnique({
      where: { id: pspId },
    })
  }

  // Récupérer les StorePSP d'une boutique (sans déchiffrement pour la liste)
  async getStorePSPsByStore(storeId: string) {
    return await this.prisma.storePSP.findMany({
      where: { storeId },
      include: {
        psp: true,
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  // Méthode pour récupérer les PSPs par boutique (alias pour getStorePSPsByStore)
  async getPSPsByStore(storeId: string) {
    return await this.getStorePSPsByStore(storeId);
  }

  // Créer un StorePSP (alias pour linkPSPToStore)
  async createStorePSP(data: { storeId: string; pspId: string }) {
    return await this.linkPSPToStore(data.storeId, data.pspId);
  }

  // Mettre à jour un PSP global (paramètres généraux)
  async updatePSP(pspId: string, updateData: {
    name?: string;
    monthlyCapacityEur?: number | null;
    dailyCapacityEur?: number | null;
    isActive?: boolean;
    selfieVerified?: boolean;
  }) {
    return await this.prisma.psp.update({
      where: { id: pspId },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    })
  }

  // Soft delete un PSP (archiver)
  async softDeletePSP(pspId: string) {
    return await this.prisma.psp.update({
      where: { id: pspId },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    })
  }

  // Restaurer un PSP archivé
  async restorePSP(pspId: string) {
    return await this.prisma.psp.update({
      where: { id: pspId },
      data: {
        isActive: true,
        deletedAt: null,
      },
    })
  }

  // Hard delete un PSP global (suppression définitive)
  async hardDeletePSP(pspId: string, force: boolean = false) {
    // Vérifier s'il y a des paiements liés à ce PSP
    const paymentCount = await this.prisma.payment.count({
      where: { pspId },
    })

    if (paymentCount > 0 && !force) {
      throw new Error(
        `Impossible de supprimer définitivement ce PSP : ${paymentCount} paiement${paymentCount > 1 ? 's' : ''} y ${paymentCount > 1 ? 'sont' : 'est'} lié${paymentCount > 1 ? 's' : ''}. Utilisez l'archivage à la place ou forcez la suppression.`
      )
    }

    // Utiliser une transaction pour garantir la cohérence
    return await this.prisma.$transaction(async (tx) => {
      // Toujours mettre à jour les paiements pour mettre pspId à null AVANT de supprimer le PSP
      // Cela évite les erreurs de contrainte de clé étrangère
      if (paymentCount > 0) {
        // Mettre à jour tous les paiements pour mettre pspId à null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await tx.payment.updateMany({
          where: { pspId },
          data: { pspId: null } as any,
        })
      }

      // Supprimer les liens avec les stores
      await tx.storePSP.deleteMany({
        where: { pspId },
      })

      // Supprimer les liens dans les listes de PSP
      await tx.pspListItem.deleteMany({
        where: { pspId },
      })

      // Supprimer les poids de routing
      await tx.pSPWeight.deleteMany({
        where: { pspId },
      })

      // Supprimer les séquences de fallback
      await tx.fallbackSequence.deleteMany({
        where: { pspId },
      })

      // Supprimer le PSP (les paiements ont maintenant pspId = null)
      return await tx.psp.delete({
        where: { id: pspId },
      })
    })
  }

  // Récupérer le nombre de paiements liés à un PSP
  async getPaymentCount(pspId: string): Promise<number> {
    return await this.prisma.payment.count({
      where: { pspId },
    })
  }

  // Alias pour rétrocompatibilité (soft delete par défaut)
  async deletePSP(pspId: string) {
    return this.softDeletePSP(pspId)
  }

  // Délier un PSP d'une boutique
  async unlinkPSPFromStore(storeId: string, pspId: string) {
    return await this.prisma.storePSP.delete({
      where: {
        storeId_pspId: { storeId, pspId }
      }
    });
  }

  /**
   * Sélectionner le meilleur PSP pour un paiement (pour WooCommerce/external integrations)
   * Retourne la clé publique et l'ID du PSP sélectionné
   */
  async selectPSPForPayment(payDomain: string, amount: number, currency: string = 'EUR'): Promise<{
    success: boolean;
    pspId?: string;
    publicKey?: string;
    error?: string;
  }> {
    try {
      // 1. Récupérer le store via payDomain
      const payDomainRecord = await this.prisma.payDomain.findUnique({
        where: { hostname: payDomain },
        include: { store: true }
      });

      if (!payDomainRecord || !payDomainRecord.store) {
        return {
          success: false,
          error: `Store non trouvé pour le domaine ${payDomain}`
        };
      }

      const storeId = payDomainRecord.storeId;

      // 2. Récupérer les PSP du store avec leurs capacités
      const storePSPs = await this.getStorePSPs(storeId);

      if (storePSPs.length === 0) {
        return {
          success: false,
          error: 'Aucun PSP configuré pour ce store'
        };
      }

      // 3. Convertir le montant en centimes pour la vérification de capacité
      const amountCents = Math.round(amount * 100);

      // 4. Filtrer les PSP qui ont de la capacité disponible
      const availablePSPs = storePSPs.filter(sp => {
        const dailyCap = sp.psp.dailyCapacityEur ?? null;
        const monthCap = sp.psp.monthlyCapacityEur ?? null;
        const dayUsage = sp.psp.currentDayUsage || 0;
        const monthUsage = sp.psp.currentMonthUsage || 0;

        // Vérifier les capacités
        if (dailyCap !== null && dayUsage + amountCents > dailyCap) return false;
        if (monthCap !== null && monthUsage + amountCents > monthCap) return false;

        return true;
      });

      if (availablePSPs.length === 0) {
        return {
          success: false,
          error: 'Aucun PSP disponible avec suffisamment de capacité'
        };
      }

      // 5. Sélectionner le PSP avec le moins d'usage actuel (balance de charge simple)
      const selectedPSP = availablePSPs.reduce((prev, current) => {
        const prevUsage = (prev.psp.currentDayUsage || 0) + (prev.psp.currentMonthUsage || 0);
        const currentUsage = (current.psp.currentDayUsage || 0) + (current.psp.currentMonthUsage || 0);
        return currentUsage < prevUsage ? current : prev;
      });

      return {
        success: true,
        pspId: selectedPSP.psp.id,
        publicKey: selectedPSP.psp.publicKey, // Déjà déchiffré par getStorePSPs
      };

    } catch (error) {
      console.error('Erreur lors de la sélection du PSP:', error);
      return {
        success: false,
        error: 'Erreur lors de la sélection du PSP'
      };
    }
  }

  // ── Stripe Connect Onboarding ─────────────────────────────────────

  private getStripeplatform(): Stripe {
    const key = process.env.STRIPE_PLATFORM_SECRET_KEY
    if (!key) throw new Error('STRIPE_PLATFORM_SECRET_KEY not configured')
    return new Stripe(key, { typescript: true })
  }

  /**
   * Génère l'URL OAuth Standard pour connecter un compte Stripe existant
   */
  async generateOAuthUrl(pspId: string, redirectUri: string): Promise<{
    oauthUrl: string;
  }> {
    const psp = await this.prisma.psp.findUnique({ where: { id: pspId } })
    if (!psp) throw new Error('PSP non trouvé')
    if (psp.stripeConnectedAccountId) {
      throw new Error('Ce PSP a déjà un compte Stripe Connect associé')
    }

    const clientId = process.env.STRIPE_CONNECT_CLIENT_ID
    if (!clientId) throw new Error('STRIPE_CONNECT_CLIENT_ID not configured')

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: 'read_write',
      state: pspId,
      redirect_uri: redirectUri,
    })

    const oauthUrl = `https://connect.stripe.com/oauth/authorize?${params.toString()}`

    return { oauthUrl }
  }

  /**
   * Échange le code OAuth contre le stripe_user_id et le stocke sur le PSP
   */
  async handleOAuthCallback(code: string, pspId: string): Promise<{
    status: string;
    stripeConnectedAccountId: string;
  }> {
    const psp = await this.prisma.psp.findUnique({ where: { id: pspId } })
    if (!psp) throw new Error('PSP non trouvé')
    if (psp.stripeConnectedAccountId) {
      throw new Error('Ce PSP a déjà un compte Stripe Connect associé')
    }

    const stripe = this.getStripeplatform()

    // Échanger le code contre le stripe_user_id
    const response = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    })

    const stripeUserId = response.stripe_user_id
    if (!stripeUserId) {
      throw new Error('Aucun stripe_user_id reçu de Stripe')
    }

    // Stocker l'ID du compte connecté
    await this.prisma.psp.update({
      where: { id: pspId },
      data: {
        stripeConnectedAccountId: stripeUserId,
        stripeConnectStatus: 'pending',
      },
    })

    // Vérifier immédiatement le statut du compte
    const statusResult = await this.checkStripeConnectStatus(pspId)

    console.log(`✅ OAuth: PSP ${psp.name} connecté avec ${stripeUserId} → status=${statusResult.status}`)

    return {
      status: statusResult.status,
      stripeConnectedAccountId: stripeUserId,
    }
  }

  /**
   * Vérifie le statut d'un compte Connect après retour d'onboarding
   */
  async checkStripeConnectStatus(pspId: string): Promise<{
    status: string;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  }> {
    const psp = await this.prisma.psp.findUnique({ where: { id: pspId } })
    if (!psp || !psp.stripeConnectedAccountId) {
      throw new Error('PSP sans compte Stripe Connect')
    }

    const stripe = this.getStripeplatform()
    const account = await stripe.accounts.retrieve(psp.stripeConnectedAccountId)

    const status = account.details_submitted
      ? (account.charges_enabled ? 'active' : 'restricted')
      : 'pending'

    await this.prisma.psp.update({
      where: { id: pspId },
      data: {
        stripeConnectStatus: status,
        stripeChargesEnabled: account.charges_enabled ?? false,
        stripePayoutsEnabled: account.payouts_enabled ?? false,
        stripeConnectOnboardedAt: account.details_submitted ? new Date() : undefined,
        lastStripeCheck: new Date(),
      },
    })

    return {
      status,
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      detailsSubmitted: account.details_submitted ?? false,
    }
  }

  /**
   * Met à jour le statut Connect depuis un événement webhook
   */
  async handleStripeAccountUpdate(stripeAccountId: string, account: Stripe.Account) {
    const psp = await this.prisma.psp.findFirst({
      where: { stripeConnectedAccountId: stripeAccountId },
    })
    if (!psp) {
      console.log(`⚠️ Webhook: aucun PSP trouvé pour le compte ${stripeAccountId}`)
      return
    }

    const status = account.details_submitted
      ? (account.charges_enabled ? 'active' : 'restricted')
      : 'pending'

    await this.prisma.psp.update({
      where: { id: psp.id },
      data: {
        stripeConnectStatus: status,
        stripeChargesEnabled: account.charges_enabled ?? false,
        stripePayoutsEnabled: account.payouts_enabled ?? false,
        stripeConnectOnboardedAt: account.details_submitted ? new Date() : undefined,
        lastStripeCheck: new Date(),
      },
    })

    console.log(`✅ Webhook: PSP ${psp.name} (${psp.id}) → status=${status}, charges=${account.charges_enabled}`)
  }

  /**
   * Gère la déauthorisation d'un compte Connect
   */
  async handleStripeAccountDeauthorized(stripeAccountId: string) {
    const psp = await this.prisma.psp.findFirst({
      where: { stripeConnectedAccountId: stripeAccountId },
    })
    if (!psp) return

    await this.prisma.psp.update({
      where: { id: psp.id },
      data: {
        stripeConnectStatus: 'deauthorized',
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        lastStripeCheck: new Date(),
      },
    })

    console.log(`⚠️ Webhook: PSP ${psp.name} déauthorisé`)
  }
}

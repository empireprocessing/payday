import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Créer une instance pour les PSP
class PspServiceInstance {
  constructor(private prisma: PrismaClient) {}

  // Créer un PSP global
  async createPSP(data: {
    name: string
    pspType: string
    publicKey: string
    secretKey: string
    monthlyCapacityEur?: number
    dailyCapacityEur?: number
    config?: any
  }) {
    const { encryptPSPCredentials } = await import('../src/common/encryption')
    
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
    return await this.prisma.storePSP.create({
      data: {
        storeId,
        pspId,
      },
    })
  }
}

async function main() {
  console.log('🌱 Seeding database...')

  // Reset de la base de données
  console.log('🗑️ Resetting database...')
  await prisma.payment.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.fallbackSequence.deleteMany()
  await prisma.pSPWeight.deleteMany()
  await prisma.routingConfig.deleteMany()
  await prisma.storePSP.deleteMany()
  await prisma.psp.deleteMany()
  await prisma.store.deleteMany()
  console.log('✅ Database reset completed')

  const pspService = new PspServiceInstance(prisma)

  // Créer des boutiques de test
  const store1 = await prisma.store.upsert({
    where: { domain: 'boutique-mode-paris.com' },
    update: {},
    create: {
      name: 'Boutique Mode Paris',
      domain: 'boutique-mode-paris.com',
      platform: 'SHOPIFY',
      platformConfig: {
        shopifyId: 'shop_12345',
        accessToken: 'shpat_test_token_1',
      },
    },
  })

  const store2 = await prisma.store.upsert({
    where: { domain: 'techstore-pro.fr' },
    update: {},
    create: {
      name: 'Tech Store Pro',
      domain: 'techstore-pro.fr',
      platform: 'SHOPIFY',
      platformConfig: {
        shopifyId: 'shop_67890',
        accessToken: 'shpat_test_token_2',
      },
    },
  })

  const store3 = await prisma.store.upsert({
    where: { domain: 'maison-deco.shop' },
    update: {},
    create: {
      name: 'Maison & Déco',
      domain: 'maison-deco.shop',
      platform: 'SHOPIFY',
      platformConfig: {
        shopifyId: 'shop_11111',
        accessToken: 'shpat_test_token_3',
      },
    },
  })

  // Créer les PayDomains pour chaque store
  await prisma.payDomain.createMany({
    data: [
      {
        storeId: store1.id,
        hostname: 'pay.boutique-mode-paris.ltd',
        status: 'ACTIVE',
      },
      {
        storeId: store2.id,
        hostname: 'pay.techstore-pro.ltd',
        status: 'ACTIVE',
      },
      {
        storeId: store3.id,
        hostname: 'pay.maison-deco.ltd',
        status: 'ACTIVE',
      },
    ],
  })

  console.log('✅ Created stores:', store1.name, store2.name, store3.name)

  // Créer des PSP globaux (partagés)
  console.log('🔐 Creating global PSPs...')

  // Stripe PSPs (plus nombreux)
  const numerisStripe = await pspService.createPSP({
    name: 'Numeris Stripe',
    pspType: 'stripe',
    publicKey: 'pk_live_51H...',
    secretKey: 'sk_live_51H...',
    monthlyCapacityEur: 5000000, // 50,000€
    dailyCapacityEur: 200000, // 2,000€
  })

  const paytechStripe = await pspService.createPSP({
    name: 'PayTech Stripe',
    pspType: 'stripe',
    publicKey: 'pk_live_52H...',
    secretKey: 'sk_live_52H...',
    monthlyCapacityEur: 3000000, // 30,000€
    dailyCapacityEur: 150000, // 1,500€
  })

  const fintechStripe = await pspService.createPSP({
    name: 'FinTech Stripe',
    pspType: 'stripe',
    publicKey: 'pk_live_53H...',
    secretKey: 'sk_live_53H...',
    monthlyCapacityEur: 4000000, // 40,000€
    dailyCapacityEur: 180000, // 1,800€
  })

  const europayStripe = await pspService.createPSP({
    name: 'EuroPay Stripe',
    pspType: 'stripe',
    publicKey: 'pk_live_54H...',
    secretKey: 'sk_live_54H...',
    monthlyCapacityEur: 2500000, // 25,000€
    dailyCapacityEur: 120000, // 1,200€
  })

  const quickpayStripe = await pspService.createPSP({
    name: 'QuickPay Stripe',
    pspType: 'stripe',
    publicKey: 'pk_live_55H...',
    secretKey: 'sk_live_55H...',
    monthlyCapacityEur: 3500000, // 35,000€
    dailyCapacityEur: 160000, // 1,600€
  })

  // Checkout.com PSPs
  const sonayahCheckout = await pspService.createPSP({
    name: 'Sonayah Checkout',
    pspType: 'checkout',
    publicKey: 'pk_test_426...',
    secretKey: 'sk_test_426...',
    monthlyCapacityEur: 3000000, // 30,000€
    dailyCapacityEur: 150000, // 1,500€
  })

  const payflowCheckout = await pspService.createPSP({
    name: 'PayFlow Checkout',
    pspType: 'checkout',
    publicKey: 'pk_test_427...',
    secretKey: 'sk_test_427...',
    monthlyCapacityEur: 2000000, // 20,000€
    dailyCapacityEur: 100000, // 1,000€
  })

  const securepayCheckout = await pspService.createPSP({
    name: 'SecurePay Checkout',
    pspType: 'checkout',
    publicKey: 'pk_test_428...',
    secretKey: 'sk_test_428...',
    monthlyCapacityEur: 1800000, // 18,000€
    dailyCapacityEur: 90000, // 900€
  })

  // PayPal PSPs
  const heypayPaypal = await pspService.createPSP({
    name: 'HeyPay PayPal',
    pspType: 'paypal',
    publicKey: 'AYjcyDzI...',
    secretKey: 'EHws3D5F...',
    monthlyCapacityEur: 1000000, // 10,000€
    dailyCapacityEur: 50000, // 500€
  })

  const paypalPro = await pspService.createPSP({
    name: 'PayPal Pro',
    pspType: 'paypal',
    publicKey: 'AYjcyDzI2...',
    secretKey: 'EHws3D5F2...',
    monthlyCapacityEur: 1500000, // 15,000€
    dailyCapacityEur: 75000, // 750€
  })

  const paypalBusiness = await pspService.createPSP({
    name: 'PayPal Business',
    pspType: 'paypal',
    publicKey: 'AYjcyDzI3...',
    secretKey: 'EHws3D5F3...',
    monthlyCapacityEur: 1200000, // 12,000€
    dailyCapacityEur: 60000, // 600€
  })

  console.log('✅ Created global PSPs')

  // Lier les PSP aux boutiques
  console.log('🔗 Linking PSPs to stores...')

  // Boutique 1 : Numeris + Sonayah
  const link1_numeris = await pspService.linkPSPToStore(store1.id, numerisStripe.id)
  const link1_sonayah = await pspService.linkPSPToStore(store1.id, sonayahCheckout.id)

  // Boutique 2 : PayTech + HeyPay
  const link2_paytech = await pspService.linkPSPToStore(store2.id, paytechStripe.id)
  const link2_heypay = await pspService.linkPSPToStore(store2.id, heypayPaypal.id)

  // Boutique 3 : FinTech + PayFlow
  const link3_fintech = await pspService.linkPSPToStore(store3.id, fintechStripe.id)
  const link3_payflow = await pspService.linkPSPToStore(store3.id, payflowCheckout.id)

  console.log('✅ Linked PSPs to stores')

  // Créer des configurations de routing
  console.log('⚙️ Creating routing configurations...')

  const routing1 = await prisma.routingConfig.upsert({
    where: { storeId: store1.id },
    update: {},
    create: {
      storeId: store1.id,
      mode: 'AUTOMATIC',
      fallbackEnabled: true,
      maxRetries: 2,
    },
  })

  const routing2 = await prisma.routingConfig.upsert({
    where: { storeId: store2.id },
    update: {},
    create: {
      storeId: store2.id,
      mode: 'MANUAL',
      fallbackEnabled: true,
      maxRetries: 3,
    },
  })

  // Créer des poids pour le routing manuel de store2
  await prisma.pSPWeight.createMany({
    data: [
      { routingConfigId: routing2.id, pspId: paytechStripe.id, weight: 70 },
      { routingConfigId: routing2.id, pspId: heypayPaypal.id, weight: 30 },
    ],
  })

  // Créer des séquences de fallback (on les créera plus tard via l'interface)
  // await prisma.fallbackSequence.createMany({
  //   data: [
  //     { routingConfigId: routing1.id, pspId: numerisStripe.id, order: 1 },
  //     { routingConfigId: routing1.id, pspId: sonayahCheckout.id, order: 2 },
  //     { routingConfigId: routing2.id, pspId: paytechStripe.id, order: 1 },
  //     { routingConfigId: routing2.id, pspId: heypayPaypal.id, order: 2 },
  //   ],
  // })

  console.log('✅ Created routing configurations')

  // Créer des commandes et paiements de test pour alimenter les analytics
  console.log('📊 Creating sample orders and payments...')

  // Les PSP globaux sont maintenant disponibles

  // Préparer les données en batch pour les 7 derniers jours seulement (plus rapide)
  const today = new Date()
  const ordersData = []
  const paymentsData = []
  const itemsData = []
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    
    // 10-30 commandes par jour
    const ordersCount = Math.floor(Math.random() * 20) + 10
    
    for (let j = 0; j < ordersCount; j++) {
      const orderId = `order_${i}_${j}_${Date.now()}`
      
      // Choisir une boutique aléatoirement
      const stores = [store1, store2, store3]
      const randomStore = stores[Math.floor(Math.random() * stores.length)]
      
      const subtotal = Math.floor(Math.random() * 50000) + 1000 // 10€ à 500€
      const shippingCost = Math.floor(Math.random() * 1000) // 0€ à 10€
      const totalAmount = subtotal + shippingCost
      const paymentStatus = Math.random() > 0.1 ? 'SUCCESS' : 'FAILED' // 90% de succès
      
      // Préparer la commande
      ordersData.push({
        id: orderId,
        storeId: randomStore.id,
        customerEmail: `customer${i}${j}@example.com`,
        subtotal,
        shippingCost,
        totalAmount,
        currency: 'EUR',
        status: 'CONFIRMED' as const,
        paymentStatus: paymentStatus as any,
        createdAt: date,
        updatedAt: date,
      })

      // Préparer 1-2 items par commande
      const itemsCount = Math.floor(Math.random() * 2) + 1
      for (let k = 0; k < itemsCount; k++) {
        const unitPrice = Math.floor(Math.random() * 20000) + 1000
        const quantity = Math.floor(Math.random() * 3) + 1
        
        itemsData.push({
          orderId,
          productId: `prod_${k + 1}`,
          quantity,
          unitPrice,
          totalPrice: unitPrice * quantity,
          name: `Product ${k + 1}`,
          description: `Description for product ${k + 1}`,
        })
      }

      // Créer un paiement associé avec un PSP aléatoire
      const allPsps = [numerisStripe, paytechStripe, fintechStripe, europayStripe, quickpayStripe, sonayahCheckout, payflowCheckout, securepayCheckout, heypayPaypal, paypalPro, paypalBusiness]
      const randomPsp = allPsps[Math.floor(Math.random() * allPsps.length)]
      
      paymentsData.push({
        orderId,
        storeId: randomStore.id,
        pspId: randomPsp.id,
        pspPaymentId: `pi_${Date.now()}_${i}_${j}`,
        pspIntentId: `pi_intent_${Date.now()}_${i}_${j}`,
        attemptNumber: Math.random() > 0.8 ? 2 : 1,
        isFallback: Math.random() > 0.9,
        processingTimeMs: Math.floor(Math.random() * 5000) + 500,
        amount: totalAmount,
        currency: 'EUR',
        status: paymentStatus as any,
        failureReason: paymentStatus === 'FAILED' ? 'card_declined' : null,
        createdAt: date,
        updatedAt: date,
      })
    }
  }

  // Insérer tout en batch (beaucoup plus rapide !)
  console.log(`📦 Inserting ${ordersData.length} orders in batch...`)
  await prisma.order.createMany({ data: ordersData })

  console.log(`📦 Inserting ${itemsData.length} order items in batch...`)
  await prisma.orderItem.createMany({ data: itemsData })

  console.log(`📦 Inserting ${paymentsData.length} payments in batch...`)
  await prisma.payment.createMany({ data: paymentsData })

  console.log('✅ Created sample orders and payments for analytics (7 days of data)')

  console.log('🎉 Seeding completed!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
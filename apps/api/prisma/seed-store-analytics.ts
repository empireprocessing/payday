import { PrismaClient, PaymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding analytics data for ma-boutique-de-test2-2.myshopify.com...');

  // 1. Trouver le store
  const store = await prisma.store.findUnique({
    where: { domain: 'ma-boutique-de-test2-2.myshopify.com' },
    include: {
      psps: {
        include: { psp: true }
      }
    }
  });

  if (!store) {
    console.error('❌ Store not found with domain: ma-boutique-de-test2-2.myshopify.com');
    console.log('💡 Available stores:');
    const stores = await prisma.store.findMany({ select: { domain: true, name: true } });
    stores.forEach(s => console.log(`   - ${s.name}: ${s.domain}`));
    return;
  }

  console.log(`✅ Store found: ${store.name} (${store.id})`);

  // 2. Récupérer un PSP du store
  if (store.psps.length === 0) {
    console.error('❌ No PSP configured for this store');
    return;
  }

  const storePsp = store.psps[0];
  console.log(`✅ Using PSP: ${storePsp.psp.name} (${storePsp.psp.id})`);

  // 3. Générer des paiements sur les 30 derniers jours
  const now = new Date();
  const paymentsToCreate = [];

  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const date = new Date(now);
    date.setDate(date.getDate() - dayOffset);
    date.setHours(12, 0, 0, 0); // Midi pour chaque jour

    // Varier le nombre de paiements par jour (entre 2 et 15)
    const numPayments = Math.floor(Math.random() * 14) + 2;

    for (let i = 0; i < numPayments; i++) {
      const paymentDate = new Date(date);
      paymentDate.setHours(Math.floor(Math.random() * 24));
      paymentDate.setMinutes(Math.floor(Math.random() * 60));

      // Montants variés entre 10€ et 500€
      const amounts = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 5000, 7500, 10000, 15000, 20000, 30000, 50000];
      const amount = amounts[Math.floor(Math.random() * amounts.length)];

      // 90% de succès, 10% d'échecs
      const isSuccess = Math.random() > 0.1;

      paymentsToCreate.push({
        storeId: store.id,
        pspId: storePsp.psp.id,
        pspIntentId: `pi_test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        amount,
        currency: 'EUR',
        status: isSuccess ? PaymentStatus.SUCCESS : PaymentStatus.FAILED,
        attemptNumber: 1,
        isFallback: false,
        processingTimeMs: Math.floor(Math.random() * 3000) + 500,
        pspMetadata: {
          storeId: store.id,
          storeDomain: store.domain,
          pspType: storePsp.psp.pspType,
          test: true,
        },
        createdAt: paymentDate,
        updatedAt: paymentDate,
      });
    }
  }

  console.log(`📊 Creating ${paymentsToCreate.length} payments...`);

  // 4. Créer les paiements en batch
  let created = 0;
  for (const payment of paymentsToCreate) {
    await prisma.payment.create({ data: payment });
    created++;
    if (created % 50 === 0) {
      console.log(`   ⏳ ${created}/${paymentsToCreate.length} payments created...`);
    }
  }

  console.log(`✅ ${created} payments created successfully!`);

  // 5. Statistiques
  const successfulPayments = paymentsToCreate.filter(p => p.status === PaymentStatus.SUCCESS);
  const totalRevenue = successfulPayments.reduce((sum, p) => sum + p.amount, 0);

  console.log('\n📈 Summary:');
  console.log(`   Total payments: ${paymentsToCreate.length}`);
  console.log(`   Successful: ${successfulPayments.length} (${((successfulPayments.length / paymentsToCreate.length) * 100).toFixed(1)}%)`);
  console.log(`   Failed: ${paymentsToCreate.length - successfulPayments.length}`);
  console.log(`   Total revenue: ${(totalRevenue / 100).toFixed(2)} €`);
  console.log(`   Average per day: ${(totalRevenue / 100 / 30).toFixed(2)} €`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

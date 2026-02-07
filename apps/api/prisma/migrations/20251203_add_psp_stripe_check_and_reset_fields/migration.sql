-- AlterTable
ALTER TABLE "psps" ADD COLUMN "lastDayUsageReset" TIMESTAMP(3);
ALTER TABLE "psps" ADD COLUMN "lastMonthUsageReset" TIMESTAMP(3);
ALTER TABLE "psps" ADD COLUMN "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "psps" ADD COLUMN "lastStripeCheck" TIMESTAMP(3);

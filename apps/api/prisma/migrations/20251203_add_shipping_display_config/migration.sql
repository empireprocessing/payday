-- AlterTable
ALTER TABLE "stores" ADD COLUMN "shippingMethodTitle" TEXT;
ALTER TABLE "stores" ADD COLUMN "shippingMethodSubtitle" TEXT;
ALTER TABLE "stores" ADD COLUMN "shippingMinDays" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "stores" ADD COLUMN "shippingMaxDays" INTEGER NOT NULL DEFAULT 2;

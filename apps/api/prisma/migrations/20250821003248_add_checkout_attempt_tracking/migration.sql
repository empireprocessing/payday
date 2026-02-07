-- AlterTable
ALTER TABLE "public"."checkouts" ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "lastAttemptPspId" TEXT,
ADD COLUMN     "lastAttemptStatus" "public"."PaymentStatus",
ADD COLUMN     "totalAttempts" INTEGER NOT NULL DEFAULT 0;

-- CreateEnum
CREATE TYPE "public"."CheckoutStep" AS ENUM ('CHECKOUT_INITIATED', 'CUSTOMER_INFO_ENTERED', 'PAYMENT_INFO_STARTED', 'PAYMENT_INFO_COMPLETED', 'PAY_BUTTON_CLICKED', 'PAYMENT_ATTEMPTED', 'PAYMENT_SUCCESSFUL', 'PAYMENT_FAILED');

-- CreateTable
CREATE TABLE "public"."checkout_events" (
    "id" TEXT NOT NULL,
    "checkoutId" TEXT NOT NULL,
    "step" "public"."CheckoutStep" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkout_events_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."checkout_events" ADD CONSTRAINT "checkout_events_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "public"."checkouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

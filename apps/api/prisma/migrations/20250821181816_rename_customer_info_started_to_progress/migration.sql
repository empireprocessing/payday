/*
  Warnings:

  - The values [CUSTOMER_INFO_STARTED] on the enum `CheckoutStep` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."CheckoutStep_new" AS ENUM ('CHECKOUT_INITIATED', 'CUSTOMER_INFO_PROGRESS', 'CUSTOMER_INFO_ENTERED', 'PAYMENT_INFO_STARTED', 'PAYMENT_INFO_COMPLETED', 'PAY_BUTTON_CLICKED', 'PAYMENT_ATTEMPTED', 'PAYMENT_SUCCESSFUL', 'PAYMENT_FAILED');
ALTER TABLE "public"."checkout_events" ALTER COLUMN "step" TYPE "public"."CheckoutStep_new" USING ("step"::text::"public"."CheckoutStep_new");
ALTER TYPE "public"."CheckoutStep" RENAME TO "CheckoutStep_old";
ALTER TYPE "public"."CheckoutStep_new" RENAME TO "CheckoutStep";
DROP TYPE "public"."CheckoutStep_old";
COMMIT;

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."RoutingMode" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "public"."stores" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "payDomain" TEXT NOT NULL,
    "supportEmail" TEXT,
    "logoUrl" TEXT,
    "shopifyId" TEXT NOT NULL,
    "shopifyAccessToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."psps" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pspType" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "secretKey" TEXT NOT NULL,
    "monthlyCapacityEur" INTEGER,
    "dailyCapacityEur" INTEGER,
    "currentMonthUsage" INTEGER NOT NULL DEFAULT 0,
    "currentDayUsage" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "psps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."store_psps" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "pspId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_psps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."orders" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "shippingCost" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "metadata" JSONB,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "storeId" TEXT NOT NULL,
    "pspId" TEXT NOT NULL,
    "pspPaymentId" TEXT,
    "pspIntentId" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "processingTimeMs" INTEGER,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "pspMetadata" JSONB,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."routing_configs" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "mode" "public"."RoutingMode" NOT NULL DEFAULT 'AUTOMATIC',
    "fallbackEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxRetries" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routing_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."psp_weights" (
    "id" TEXT NOT NULL,
    "routingConfigId" TEXT NOT NULL,
    "pspId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "psp_weights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fallback_sequences" (
    "id" TEXT NOT NULL,
    "routingConfigId" TEXT NOT NULL,
    "pspId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fallback_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "public"."AuditAction" NOT NULL,
    "changes" JSONB,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stores_domain_key" ON "public"."stores"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "stores_payDomain_key" ON "public"."stores"("payDomain");

-- CreateIndex
CREATE UNIQUE INDEX "stores_shopifyId_key" ON "public"."stores"("shopifyId");

-- CreateIndex
CREATE UNIQUE INDEX "store_psps_storeId_pspId_key" ON "public"."store_psps"("storeId", "pspId");

-- CreateIndex
CREATE UNIQUE INDEX "routing_configs_storeId_key" ON "public"."routing_configs"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "psp_weights_routingConfigId_pspId_key" ON "public"."psp_weights"("routingConfigId", "pspId");

-- CreateIndex
CREATE UNIQUE INDEX "fallback_sequences_routingConfigId_order_key" ON "public"."fallback_sequences"("routingConfigId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "fallback_sequences_routingConfigId_pspId_key" ON "public"."fallback_sequences"("routingConfigId", "pspId");

-- AddForeignKey
ALTER TABLE "public"."store_psps" ADD CONSTRAINT "store_psps_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."store_psps" ADD CONSTRAINT "store_psps_pspId_fkey" FOREIGN KEY ("pspId") REFERENCES "public"."psps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_pspId_fkey" FOREIGN KEY ("pspId") REFERENCES "public"."psps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."routing_configs" ADD CONSTRAINT "routing_configs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."psp_weights" ADD CONSTRAINT "psp_weights_routingConfigId_fkey" FOREIGN KEY ("routingConfigId") REFERENCES "public"."routing_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."psp_weights" ADD CONSTRAINT "psp_weights_pspId_fkey" FOREIGN KEY ("pspId") REFERENCES "public"."psps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fallback_sequences" ADD CONSTRAINT "fallback_sequences_routingConfigId_fkey" FOREIGN KEY ("routingConfigId") REFERENCES "public"."routing_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fallback_sequences" ADD CONSTRAINT "fallback_sequences_pspId_fkey" FOREIGN KEY ("pspId") REFERENCES "public"."psps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

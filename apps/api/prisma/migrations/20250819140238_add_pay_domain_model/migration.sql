/*
  Warnings:

  - You are about to drop the column `payDomain` on the `stores` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."PayDomainStatus" AS ENUM ('PENDING', 'ACTIVE', 'FAILED');

-- DropIndex
DROP INDEX "public"."stores_payDomain_key";

-- AlterTable
ALTER TABLE "public"."stores" DROP COLUMN "payDomain";

-- CreateTable
CREATE TABLE "public"."domains" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "status" "public"."PayDomainStatus" NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "domains_storeId_key" ON "public"."domains"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "domains_hostname_key" ON "public"."domains"("hostname");

-- AddForeignKey
ALTER TABLE "public"."domains" ADD CONSTRAINT "domains_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

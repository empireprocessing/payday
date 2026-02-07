/*
  Warnings:

  - You are about to drop the column `shopifyAccessToken` on the `stores` table. All the data in the column will be lost.
  - You are about to drop the column `shopifyId` on the `stores` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."stores" DROP COLUMN "shopifyAccessToken",
DROP COLUMN "shopifyId",
ADD COLUMN     "requiresShipping" BOOLEAN NOT NULL DEFAULT true;

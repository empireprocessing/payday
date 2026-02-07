/*
  Warnings:

  - You are about to drop the column `dnsRecords` on the `domains` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."domains" DROP COLUMN "dnsRecords";

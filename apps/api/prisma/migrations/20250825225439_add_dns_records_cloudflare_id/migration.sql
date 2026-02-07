-- AlterTable
ALTER TABLE "public"."domains" ADD COLUMN     "cloudflareHostnameId" TEXT,
ADD COLUMN     "dnsRecords" JSONB;

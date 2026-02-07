-- AlterTable
ALTER TABLE "stores" ADD COLUMN "pspListId" TEXT;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_pspListId_fkey" FOREIGN KEY ("pspListId") REFERENCES "psp_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "psp_lists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "psp_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psp_list_items" (
    "id" TEXT NOT NULL,
    "pspListId" TEXT NOT NULL,
    "pspId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "psp_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "psp_list_items_pspListId_pspId_key" ON "psp_list_items"("pspListId", "pspId");

-- AddForeignKey
ALTER TABLE "psp_list_items" ADD CONSTRAINT "psp_list_items_pspListId_fkey" FOREIGN KEY ("pspListId") REFERENCES "psp_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psp_list_items" ADD CONSTRAINT "psp_list_items_pspId_fkey" FOREIGN KEY ("pspId") REFERENCES "psps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

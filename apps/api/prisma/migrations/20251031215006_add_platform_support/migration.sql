-- CreateEnum (si n'existe pas déjà)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StorePlatform') THEN
        CREATE TYPE "StorePlatform" AS ENUM ('SHOPIFY', 'WOOCOMMERCE', 'PRESTASHOP', 'MAGENTO', 'CUSTOM');
    END IF;
END $$;

-- AlterTable: Ajouter les nouveaux champs (si n'existent pas)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'platform') THEN
        ALTER TABLE "stores" ADD COLUMN "platform" "StorePlatform" NOT NULL DEFAULT 'SHOPIFY';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'platformConfig') THEN
        ALTER TABLE "stores" ADD COLUMN "platformConfig" JSONB;
    END IF;
END $$;

-- AlterTable: Rendre shopifyId optionnel (enlever NOT NULL)
DO $$
BEGIN
    ALTER TABLE "stores" ALTER COLUMN "shopifyId" DROP NOT NULL;
EXCEPTION
    WHEN others THEN NULL; -- Ignore si déjà optionnel
END $$;

-- Supprimer l'index/contrainte unique sur shopifyId s'il existe
DO $$
BEGIN
    -- Essayer de supprimer la contrainte si elle existe
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'stores_shopifyId_key'
    ) THEN
        ALTER TABLE "stores" DROP CONSTRAINT "stores_shopifyId_key";
    END IF;

    -- Supprimer l'index s'il existe déjà
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'stores_shopifyId_key'
    ) THEN
        DROP INDEX "stores_shopifyId_key";
    END IF;
END $$;

-- Créer un index unique partiel (unique seulement pour les valeurs non-NULL)
CREATE UNIQUE INDEX "stores_shopifyId_key" ON "stores"("shopifyId") WHERE "shopifyId" IS NOT NULL;

-- Migrer les données existantes: Créer platformConfig pour les stores Shopify existants
UPDATE "stores"
SET "platformConfig" = jsonb_build_object(
  'shopifyId', "shopifyId",
  'accessToken', COALESCE("shopifyAccessToken", '')
)
WHERE "shopifyId" IS NOT NULL;

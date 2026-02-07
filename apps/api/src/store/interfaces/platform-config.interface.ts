/**
 * Interfaces pour les configurations spécifiques à chaque plateforme e-commerce
 */

// Enum des plateformes (doit matcher le schema Prisma)
export enum StorePlatform {
  SHOPIFY = 'SHOPIFY',
  WOOCOMMERCE = 'WOOCOMMERCE',
  PRESTASHOP = 'PRESTASHOP',
  MAGENTO = 'MAGENTO',
  CUSTOM = 'CUSTOM',
}

// Configuration pour Shopify
export interface ShopifyConfig {
  shopifyId: string;
  clientId: string;
  clientSecret: string;
  accessToken?: string; // Set via OAuth callback
}

// Configuration pour WooCommerce (pas besoin de credentials, détection par domaine)
export interface WooCommerceConfig {
  // Vide pour l'instant, on détecte juste par domaine
  // On pourrait ajouter plus tard si besoin : { apiKey?, consumerSecret? }
}

// Configuration pour Prestashop
export interface PrestashopConfig {
  apiKey: string;
  shopUrl?: string;
}

// Configuration pour Magento
export interface MagentoConfig {
  apiKey: string;
  apiSecret: string;
  storeId?: string;
}

// Configuration custom (pour intégrations custom)
export interface CustomConfig {
  [key: string]: any;
}

// Union type de toutes les configs possibles
export type PlatformConfig =
  | ShopifyConfig
  | WooCommerceConfig
  | PrestashopConfig
  | MagentoConfig
  | CustomConfig
  | null;

// Helper pour valider les configs
export function validatePlatformConfig(
  platform: StorePlatform,
  config: any,
): { valid: boolean; error?: string } {
  switch (platform) {
    case StorePlatform.SHOPIFY:
      if (!config?.shopifyId || !config?.clientId || !config?.clientSecret) {
        return {
          valid: false,
          error: 'Shopify requires shopifyId, clientId and clientSecret',
        };
      }
      return { valid: true };

    case StorePlatform.WOOCOMMERCE:
      // WooCommerce n'a pas besoin de config (détection par domaine)
      return { valid: true };

    case StorePlatform.PRESTASHOP:
      if (!config?.apiKey) {
        return { valid: false, error: 'Prestashop requires apiKey' };
      }
      return { valid: true };

    case StorePlatform.MAGENTO:
      if (!config?.apiKey || !config?.apiSecret) {
        return { valid: false, error: 'Magento requires apiKey and apiSecret' };
      }
      return { valid: true };

    case StorePlatform.CUSTOM:
      // Custom peut avoir n'importe quelle config
      return { valid: true };

    default:
      return { valid: false, error: 'Unknown platform' };
  }
}

// Helper pour typer une config selon la plateforme
export function getPlatformConfig<T extends StorePlatform>(
  platform: T,
  config: any,
): T extends StorePlatform.SHOPIFY
  ? ShopifyConfig
  : T extends StorePlatform.WOOCOMMERCE
  ? WooCommerceConfig
  : T extends StorePlatform.PRESTASHOP
  ? PrestashopConfig
  : T extends StorePlatform.MAGENTO
  ? MagentoConfig
  : CustomConfig {
  return config as any;
}

/**
 * Types et enums partagés entre client et serveur
 * Ce fichier ne doit PAS avoir 'use server' ou 'use client'
 */

// Enum des plateformes e-commerce
export enum StorePlatform {
  SHOPIFY = 'SHOPIFY',
  WOOCOMMERCE = 'WOOCOMMERCE',
  PRESTASHOP = 'PRESTASHOP',
  MAGENTO = 'MAGENTO',
  CUSTOM = 'CUSTOM',
}

// Configurations spécifiques par plateforme
export interface ShopifyConfig {
  shopifyId: string;
  clientId: string;
  clientSecret: string;
  accessToken?: string; // Set via OAuth
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WooCommerceConfig {
  // Vide pour l'instant, détection par domaine
}

export interface PrestashopConfig {
  apiKey: string;
  shopUrl?: string;
}

export interface MagentoConfig {
  apiKey: string;
  apiSecret: string;
  storeId?: string;
}

export interface CustomConfig {
  [key: string]: unknown;
}

export type PlatformConfig =
  | ShopifyConfig
  | WooCommerceConfig
  | PrestashopConfig
  | MagentoConfig
  | CustomConfig
  | null;

// Interface Store (peut être utilisée côté client et serveur)
export interface Store {
  id: string;
  name: string;
  domain: string;
  platform: StorePlatform;
  platformConfig?: PlatformConfig;
  payDomain?: {
    id: string;
    storeId: string;
    hostname: string;
    status: 'PENDING' | 'ACTIVE' | 'FAILED';
    lastError?: string;
    createdAt: string;
    updatedAt: string;
  };
  supportEmail?: string;
  logoUrl?: string;
  runner?: string | null; // Nom de la personne responsable de la boutique
  requiresShipping?: boolean; // Si false, pas besoin d'adresse (produits virtuels)
  // Address section title (e.g., "Livraison" or "Facturation")
  addressSectionTitle?: string | null;
  // Shipping display config
  shippingMethodTitle?: string | null;
  shippingMethodSubtitle?: string | null;
  shippingMinDays?: number;
  shippingMaxDays?: number;
  // Shipping method image
  shippingDisplayType?: string | null; // "icon" (left) or "logo" (right)
  shippingImageUrl?: string | null;
  // Trust badges (icon can be emoji, imageUrl is optional image URL)
  trustBadges?: Array<{ icon: string; imageUrl?: string; title: string; subtitle: string }> | null;
  // Checkout config (language, theme, custom translations, etc.)
  checkoutConfig?: any | null;
  // Trustpilot widget config
  trustpilotEnabled?: boolean;
  trustpilotRating?: number | null; // ex: 4.7
  trustpilotReviewCount?: number | null; // ex: 3167
  trustpilotUrl?: string | null; // Lien vers la page Trustpilot
  // Garder pour rétrocompatibilité (peuvent être extraits de platformConfig)
  shopifyId?: string;
  shopifyAccessToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoreData {
  name: string;
  domain: string;
  platform: StorePlatform;
  platformConfig?: PlatformConfig;
  payDomain?: string; // Chaîne pour la création
  supportEmail?: string;
  logoUrl?: string;
  requiresShipping?: boolean;
  // Anciens champs pour rétrocompatibilité
  shopifyId?: string;
  shopifyAccessToken?: string;
}

export interface UpdateStoreData {
  name?: string;
  domain?: string;
  platform?: StorePlatform;
  platformConfig?: PlatformConfig;
  payDomain?: string; // Chaîne pour la mise à jour
  supportEmail?: string;
  logoUrl?: string;
  runner?: string | null; // Nom de la personne responsable de la boutique
  requiresShipping?: boolean;
  // Address section title (e.g., "Livraison" or "Facturation")
  addressSectionTitle?: string | null;
  // Shipping display config
  shippingMethodTitle?: string | null;
  shippingMethodSubtitle?: string | null;
  shippingMinDays?: number;
  shippingMaxDays?: number;
  // Shipping method image
  shippingDisplayType?: string | null; // "icon" (left) or "logo" (right)
  shippingImageUrl?: string | null;
  // Trust badges (icon can be emoji, imageUrl is optional image URL)
  trustBadges?: Array<{ icon: string; imageUrl?: string; title: string; subtitle: string }> | null;
  // Checkout config (language, theme, custom translations, etc.)
  checkoutConfig?: any | null;
  // Trustpilot widget config
  trustpilotEnabled?: boolean;
  trustpilotRating?: number | null;
  trustpilotReviewCount?: number | null;
  trustpilotUrl?: string | null;
  // Anciens champs pour rétrocompatibilité
  shopifyId?: string;
  shopifyAccessToken?: string;
}

// Types pour Analytics (utilisés par les server actions)
export interface OverviewMetrics {
  totalStores: number;
  totalPsps: number;
  totalOrders: number;
  totalPayments: number;
  successfulPayments: number;
  conversionRate: number;
  totalRevenue: number;
  growth: {
    stores: number;
    psps: number;
    payments: number;
    revenue: number;
  };
}

export interface StoreMetric {
  id: string;
  name: string;
  domain: string;
  platform: string;
  totalOrders: number;
  successfulOrders: number;
  totalRevenue: number;
  pspCount: number;
  conversionRate: number;
}

export interface PspMetric {
  id: string;
  pspType: string;
  name: string;
  storeName: string;
  storeId: string;
  totalPayments: number;
  successfulPayments: number;
  totalRevenue: number;
  conversionRate: number;
  isActive: boolean;
  avgProcessingTime?: number;
}

export interface TrendData {
  date: string;
  totalPayments: number;
  successfulPayments: number;
  totalAmount: number;
  successfulAmount: number;
  pspBreakdown: Record<string, {
    total: number;
    successful: number;
    amount: number;
  }>;
}

export interface PspComparison {
  pspType: string;
  name: string;
  totalConfigurations: number;
  activeConfigurations: number;
  totalPayments: number;
  successfulPayments: number;
  totalRevenue: number;
  conversionRate: number;
}

export interface StorePSP {
  id: string;
  storeId: string;
  pspType: string;
  name: string;
  publicKey: string;
  secretKey: string;
  monthlyCapacityEur?: number;
  dailyCapacityEur?: number;
  currentMonthUsage: number;
  currentDayUsage: number;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface PSPWithStoreCount {
  id: string;
  name: string;
  pspType: string;
  publicKey: string;
  secretKey: string;
  monthlyCapacityEur?: number;
  dailyCapacityEur?: number;
  currentMonthUsage: number;
  currentDayUsage: number;
  // Usage jour ouvrable (depuis 6h Paris) et 30 jours
  usageBusinessDay?: number;
  usage30d?: number;
  isActive: boolean;
  config?: Record<string, unknown> | null;
  connectedStores: number;
  // Stripe account status
  stripeChargesEnabled?: boolean;
  stripePayoutsEnabled?: boolean;
  lastStripeCheck?: string | null;
  selfieVerified?: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface StoreAnalytics {
  store: {
    id: string;
    name: string;
    domain: string;
    activePsps: number;
  };
  psps: Array<{
    id: string;
    name: string;
    pspType: string;
    totalPayments: number;
    successfulPayments: number;
    totalRevenue: number;
    conversionRate: number;
    avgProcessingTime?: number;
  }>;
  routing: {
    weights: Array<{
      pspId: string;
      pspName: string;
      weight: number;
    }>;
    fallbackSequence: Array<{
      pspId: string;
      pspName: string;
      order: number;
    }>;
  };
}

export interface PspListItem {
  id: string;
  pspListId: string;
  pspId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  psp: {
    id: string;
    name: string;
    pspType: string;
    isActive: boolean;
    deletedAt?: string | null;
  };
}

export interface PspList {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  items: PspListItem[];
  stores?: Array<{
    id: string;
    name: string;
    domain: string;
  }>;
}

export interface PaymentRecord {
  id: string
  amount: number
  currency: string
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'REFUNDED'
  failureReason?: string
  attemptNumber: number
  isFallback: boolean
  processingTimeMs?: number
  pspPaymentId?: string
  createdAt: string
  store: { id: string; name: string; domain: string }
  psp: { id: string; name: string; pspType: string }
}

export interface PaginatedPayments {
  data: PaymentRecord[]
  total: number
  page: number
  limit: number
}

export interface CreatePspListData {
  name: string;
  pspIds?: string[];
}

export interface UpdatePspListData {
  name?: string;
  pspIds?: string[];
}

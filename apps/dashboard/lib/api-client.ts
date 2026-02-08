// Re-export de tous les types depuis types.ts
export type {
  Store,
  ShopifyConfig,
  WooCommerceConfig,
  PrestashopConfig,
  MagentoConfig,
  CustomConfig,
  PlatformConfig,
  CreateStoreData,
  UpdateStoreData,
  OverviewMetrics,
  StoreMetric,
  PspMetric,
  TrendData,
  PspComparison,
  StorePSP,
  PSPWithStoreCount,
  StoreAnalytics,
  PspList,
  PspListItem,
  CreatePspListData,
  UpdatePspListData,
  PaymentRecord,
  PaginatedPayments,
  RunnerPayoutResult,
} from './types';

export type { PspWithUsage } from './actions';

export {
  StorePlatform,
} from './types';

export {
  formatCurrency,
  formatCurrencyNoDecimals,
  formatPercentage,
  formatDate
} from './utils';

// Import des server actions
import {
    // Analytics
    getAnalyticsOverview,
    getStoreMetrics,
    getPspMetrics,
    getTrendData,
    getPspComparison,
    getStoreAnalytics,
    getStoreConversionFunnel,
    getStoreDailyRevenue,
    getStoreDailyCheckouts,
    getStoreApprovalRate,
    getRealtime,
    getPspsWithUsage,
    getApprovalRates,
    getIntegrationHealth,
    getRunnerPayout,

    // Stores
    getAllStores,
    getStoreById,
    createStore,
    updateStore,
    deleteStore,

    // PSPs
    getAllPsps,
    getPspById,
    getPspsByStore,
    createPsp,
    updatePsp,
    updatePspCredentials,
    deletePsp,
    hardDeletePsp,
    getPspPaymentCount,
    restorePsp,
    createStripeConnect,
    refreshStripeConnect,
    getStripeConnectStatus,

    // StorePSP
    linkStorePsp,
    unlinkStorePsp,
    getStorePsps,
    linkPspListToStore,

    // PspList
    getAllPspLists,
    getPspListById,
    createPspList,
    updatePspList,
    deletePspList,
    addPspsToList,
    removePspFromList,

    // Orders
    getAllOrders,
    getOrderById,

    // Payments
    getAllPayments,
    getPaymentById,

    // Routing
    getRoutingConfig,
    updateRoutingConfig,
    updateRoutingWeights,
    updateRoutingFallback,

    // DNS
    verifyDnsRecord,

    // WooCommerce
    generateWooCommerceOAuthUrl,
    getWooCommerceCredentials,

    // Shopify OAuth
    generateShopifyOAuthUrl,
    getShopifyOAuthStatus,

    // Meta Conversion API
    getMetaSettings,
    updateMetaSettings,

    // TikTok Pixel
    getTiktokSettings,
    updateTiktokSettings
} from './actions';

// Client API qui utilise les server actions
export const apiClient = {
  // Analytics endpoints
  analytics: {
    getOverview: (period: 'day' | 'week' | 'month' = 'month', storeIds?: string, days?: number) => getAnalyticsOverview(period, storeIds, days),
    getStoreMetrics: (period: 'day' | 'week' | 'month' = 'month', storeIds?: string, days?: number) => getStoreMetrics(period, storeIds, days),
    getPspMetrics: (period: 'day' | 'week' | 'month' = 'month', storeIds?: string, days?: number) => getPspMetrics(period, storeIds, days),
    getTrendData: (period: 'day' | 'week' | 'month' = 'week', days: number = 7, storeIds?: string, fromDate?: Date, toDate?: Date) => getTrendData(period, days, storeIds, fromDate, toDate),
    getPspComparison: (storeIds?: string) => getPspComparison(storeIds),
    getStoreAnalytics: getStoreAnalytics,
    getStoreConversionFunnel: getStoreConversionFunnel,
    getStoreDailyRevenue: getStoreDailyRevenue,
    getStoreDailyCheckouts: getStoreDailyCheckouts,
    getStoreApprovalRate: getStoreApprovalRate,
    getRealtime: getRealtime,
    getPspsWithUsage: (storeIds?: string, period: 'day' | 'week' | 'month' = 'month', days?: number) => getPspsWithUsage(storeIds, period, days),
    getApprovalRates: (storeIds?: string, days?: number, fromDate?: Date, toDate?: Date) => getApprovalRates(storeIds, days, fromDate, toDate),
    getIntegrationHealth: getIntegrationHealth,
    getRunnerPayout: (storeIds: string[], fromDate: string, toDate: string) => getRunnerPayout(storeIds, fromDate, toDate),
  },

  // Stores endpoints
  stores: {
    getAll: getAllStores,
    getById: getStoreById,
    create: createStore,
    update: updateStore,
    delete: deleteStore,
  },

  // PSP endpoints
  psps: {
    getAll: getAllPsps,
    getById: getPspById,
    getByStore: getPspsByStore,
    create: createPsp,
    update: updatePsp,
    updateCredentials: updatePspCredentials,
    delete: deletePsp,
    hardDelete: hardDeletePsp,
    getPaymentCount: getPspPaymentCount,
    restore: restorePsp,
    stripeConnect: {
      create: createStripeConnect,
      refresh: refreshStripeConnect,
      getStatus: getStripeConnectStatus,
    },
  },

  // StorePSP endpoints
  storePsp: {
    link: linkStorePsp,
    unlink: unlinkStorePsp,
    getByStore: getStorePsps,
    linkList: linkPspListToStore,
  },

  // PspList endpoints
  pspLists: {
    getAll: getAllPspLists,
    getById: getPspListById,
    create: createPspList,
    update: updatePspList,
    delete: deletePspList,
    addPsps: addPspsToList,
    removePsp: removePspFromList,
  },

  // Orders endpoints
  orders: {
    getAll: getAllOrders,
    getById: getOrderById,
  },

  // Payments endpoints
  payments: {
    getAll: (params?: { page?: number; limit?: number; status?: string; storeId?: string; pspId?: string }) => getAllPayments(params),
    getById: getPaymentById,
  },

  // Routing endpoints
  routing: {
    getConfig: getRoutingConfig,
    updateConfig: updateRoutingConfig,
    updateWeights: updateRoutingWeights,
    updateFallback: updateRoutingFallback,
  },

  // PayDomain endpoints
  payDomains: {
    create: async (storeId: string, hostname: string) => {
      const response = await fetch(`/api/stores/${storeId}/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create pay domain');
      }
      
      return response.json();
    },
    
    getByStore: async (storeId: string) => {
      const response = await fetch(`/api/stores/${storeId}/domains`);
      
      if (!response.ok) {
        throw new Error('Failed to get pay domains');
      }
      
      return response.json();
    },
    
    verify: async (storeId: string, domainId: string) => {
      const response = await fetch(`/api/stores/${storeId}/domains/${domainId}/verify`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to verify domain');
      }
      
      return response.json();
    },

    // Récupérer les DNS records depuis Cloudflare
    getDnsRecords: async (storeId: string, domainId: string) => {
      const response = await fetch(`/api/stores/${storeId}/domains/${domainId}/dns-records`);
      
      if (!response.ok) {
        throw new Error('Failed to get DNS records');
      }
      
      return response.json();
    },

    // Vérification DNS directe (sans storeId) - DEPRECATED, utiliser getDnsRecords
    verifyDns: async (hostname: string) => {
      return verifyDnsRecord(hostname);
    },
  },

  // WooCommerce endpoints
  woocommerce: {
    generateOAuthUrl: generateWooCommerceOAuthUrl,
    getCredentials: getWooCommerceCredentials,
  },

  // Shopify OAuth endpoints
  shopify: {
    generateOAuthUrl: generateShopifyOAuthUrl,
    getOAuthStatus: getShopifyOAuthStatus,
  },

  // Meta Conversion API endpoints
  meta: {
    getSettings: getMetaSettings,
    updateSettings: updateMetaSettings,
  },

  // TikTok Pixel endpoints
  tiktok: {
    getSettings: getTiktokSettings,
    updateSettings: updateTiktokSettings,
  },
};

// Hook pour gérer les erreurs API (maintenant géré côté serveur)
export function useApiError() {
  return {
    handleError: (error: unknown) => {
      console.error('API Error:', error);
      if (error instanceof Error) {
        return error.message;
      }
      return 'Une erreur inattendue est survenue';
    }
  };
}

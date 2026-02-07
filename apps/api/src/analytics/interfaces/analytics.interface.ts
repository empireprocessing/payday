export interface OverviewMetrics {
  totalStores: number;
  totalPsps: number;
  totalOrders: number;
  totalPayments: number;
  successfulPayments: number;
  conversionRate: number;
  totalRevenue: number;
  // Données de croissance par rapport à la période précédente
  growth: {
    stores: number; // pourcentage de croissance des boutiques
    psps: number; // pourcentage de croissance des PSP
    payments: number; // pourcentage de croissance des paiements
    revenue: number; // pourcentage de croissance des revenus
  };
}

export interface StoreMetric {
  id: string;
  name: string;
  domain: string;
  totalOrders: number;
  successfulOrders: number;
  totalRevenue: number;
  pspCount: number;
  conversionRate: number;
}

export interface PspMetric {
  id: string;
  pspType: string;
  storeName: string;
  storeId: string;
  totalPayments: number;
  successfulPayments: number;
  totalRevenue: number;
  conversionRate: number;
  isActive: boolean;
}

export interface DailyTrendData {
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
  totalConfigurations: number;
  activeConfigurations: number;
  totalPayments: number;
  successfulPayments: number;
  totalRevenue: number;
  conversionRate: number;
}

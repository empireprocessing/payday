'use server';

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Import des types partagés pour utilisation interne uniquement
import type {
  ShopifyConfig,
  WooCommerceConfig,
  PrestashopConfig,
  MagentoConfig,
  CustomConfig,
  PlatformConfig,
  Store,
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
  CreatePspListData,
  UpdatePspListData,
  PaginatedPayments,
  RunnerPayoutResult,
} from './types';

// IMPORTANT: Un fichier 'use server' ne peut exporter QUE des fonctions async
// Les types doivent être importés depuis './types' par les consommateurs
// Tous les types sont maintenant définis dans types.ts et importés ci-dessus

// Configuration de l'API interne
// Utiliser 127.0.0.1 au lieu de localhost pour les Server Actions
const API_BASE_URL = process.env.INTERNAL_API_URL || 'http://127.0.0.1:5000';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    // S'assurer que le message est bien défini pour la sérialisation
    Object.setPrototypeOf(this, ApiError.prototype);
  }
  
  // Méthode pour sérialiser l'erreur
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
    };
  }
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}, retries = 3, delay = 1000): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        // Essayer de récupérer le message d'erreur du body
        let errorMessage = `API Error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Si le body n'est pas du JSON, utiliser le message par défaut
        }
        throw new ApiError(response.status, errorMessage);
      }

      // Pour les réponses DELETE qui peuvent être 204 No Content, ne pas essayer de parser JSON
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return undefined as T;
      }

      // Vérifier si le body est vide avant de parser
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        if (text.trim() === '') {
          return undefined as T;
        }
        return JSON.parse(text);
      }

      return undefined as T;
    } catch (error) {
      // Si c'est une erreur de connexion et qu'il reste des tentatives
      if (error instanceof TypeError && error.message.includes('fetch')) {
        if (attempt < retries - 1) {
          // Attendre avant de réessayer (délai progressif)
          await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
          continue;
        }
        // Dernière tentative échouée
        throw new ApiError(0, `Impossible de se connecter à l'API (${url}). Vérifiez que l'API est démarrée.`);
      }
      // Pour les autres erreurs, ne pas réessayer
      throw error;
    }
  }

  // Ne devrait jamais arriver ici, mais TypeScript le demande
  throw new ApiError(0, `Impossible de se connecter à l'API (${url}).`);
}

// Server Actions pour Analytics
export async function getAnalyticsOverview(period: 'day' | 'week' | 'month' = 'month', storeIds?: string, days?: number): Promise<OverviewMetrics> {
  const params = new URLSearchParams({ period });
  if (storeIds) {
    params.append('storeIds', storeIds);
  }
  // Toujours passer days si fourni pour garantir la cohérence avec getTrendData
  if (days !== undefined && days !== null) {
    params.append('days', days.toString());
  }
  return apiRequest(`/analytics/overview?${params.toString()}`);
}

export async function getStoreMetrics(period: 'day' | 'week' | 'month' = 'month', storeIds?: string, days?: number): Promise<StoreMetric[]> {
  const params = new URLSearchParams({ period });
  if (storeIds) {
    params.append('storeIds', storeIds);
  }
  if (days) {
    params.append('days', days.toString());
  }
  return apiRequest(`/analytics/stores?${params.toString()}`);
}

export async function getPspMetrics(period: 'day' | 'week' | 'month' = 'month', storeIds?: string, days?: number): Promise<PspMetric[]> {
  const params = new URLSearchParams({ period });
  if (storeIds) {
    params.append('storeIds', storeIds);
  }
  if (days) {
    params.append('days', days.toString());
  }
  return apiRequest(`/analytics/psps?${params.toString()}`);
}

export async function getTrendData(period: 'day' | 'week' | 'month' = 'week', days: number = 7, storeIds?: string, fromDate?: Date, toDate?: Date): Promise<TrendData[]> {
  const params = new URLSearchParams({ period, days: days.toString() });
  if (storeIds) {
    params.append('storeIds', storeIds);
  }
  if (fromDate) {
    params.append('fromDate', fromDate.toISOString());
  }
  if (toDate) {
    params.append('toDate', toDate.toISOString());
  }
  return apiRequest(`/analytics/trends?${params.toString()}`);
}

export async function getPspComparison(storeIds?: string): Promise<PspComparison[]> {
  const params = new URLSearchParams();
  if (storeIds) {
    params.append('storeIds', storeIds);
  }
  const queryString = params.toString();
  return apiRequest(`/analytics/psp-comparison${queryString ? `?${queryString}` : ''}`);
}

export interface PspWithUsage {
  id: string;
  name: string;
  pspType: string;
  usageBusinessDay: number; // Usage depuis 6h Paris (jour ouvrable)
  capacity: number | null;
  isActive: boolean;
  totalPayments: number;
  totalRevenue: number;
}

export async function getPspsWithUsage(storeIds?: string, period: 'day' | 'week' | 'month' = 'month', days?: number): Promise<PspWithUsage[]> {
  const params = new URLSearchParams({ period });
  if (storeIds) {
    params.append('storeIds', storeIds);
  }
  if (days) {
    params.append('days', days.toString());
  }
  const queryString = params.toString();
  return apiRequest(`/analytics/psps-usage?${queryString}`);
}

export interface ApprovalRateData {
  date: string;
  totalPayments: number;
  successfulPayments: number;
  approvalRate: number;
}

export interface ApprovalRatesResponse {
  approvalRates: ApprovalRateData[];
  recurringApprovalRates: ApprovalRateData[];
  globalApprovalRate: number;
  globalRecurringApprovalRate: number;
}

export async function getApprovalRates(
  storeIds?: string,
  days?: number,
  fromDate?: Date,
  toDate?: Date
): Promise<ApprovalRatesResponse> {
  const params = new URLSearchParams();
  if (storeIds) {
    params.append('storeIds', storeIds);
  }
  if (days) {
    params.append('days', days.toString());
  }
  if (fromDate) {
    params.append('fromDate', fromDate.toISOString());
  }
  if (toDate) {
    params.append('toDate', toDate.toISOString());
  }
  const queryString = params.toString();
  return apiRequest(`/analytics/approval-rates?${queryString}`);
}

// Health / Integration Status
export interface IntegrationHealthResponse {
  connect: { total: number; active: number; pending: number; disconnected: number; restricted: number };
  basisTheory: { configured: boolean };
  cascade: { firstTryRate: number; fallbackRate: number; failRate: number; totalPayments: number };
}

export async function getIntegrationHealth(): Promise<IntegrationHealthResponse> {
  return apiRequest('/analytics/health');
}

export async function getRunnerPayout(storeIds: string[], fromDate: string, toDate: string): Promise<RunnerPayoutResult> {
  const params = new URLSearchParams({ storeIds: storeIds.join(','), fromDate, toDate });
  return apiRequest(`/analytics/runner-payout?${params.toString()}`);
}

export interface PspDetailsResponse {
  psp: {
    id: string;
    name: string;
    pspType: string;
    publicKey: string;
    monthlyCapacityEur: number | null;
    dailyCapacityEur: number | null;
    isActive: boolean;
    stripeChargesEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  lifetimeMetrics: {
    totalAttempts: number;
    successful: number;
    failed: number;
    totalVolume: number;
    successVolume: number;
    declineVolume: number;
    approvalRate: number;
    avgTransaction: number;
  };
  thisMonthMetrics: {
    totalAttempts: number;
    successful: number;
    failed: number;
    totalVolume: number;
    successVolume: number;
    declineVolume: number;
    approvalRate: number;
    volumePerDay: number;
  };
  keyRatios: {
    totalAttempts: number;
    avgTransaction: number;
    successful: number;
    volumePerDay: number;
    failed: number;
  };
  stripeAccountDetails?: {
    accountId: string;
    businessName: string | null;
    businessType: string | null;
    country: string | null;
    defaultCurrency: string | null;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    mode: 'live' | 'test';
  };
}

export async function getPspDetails(pspId: string): Promise<PspDetailsResponse> {
  return apiRequest(`/analytics/psp/${pspId}`);
}

export interface PspUsageTrendData {
  date: string;
  usageReal: number; // Usage réel du jour (en centimes)
  usage24hCapPercent: number; // Pourcentage de la capacité quotidienne
  usage30jCapPercent: number; // Pourcentage de la capacité mensuelle
  dailyCapacity: number | null; // Capacité quotidienne en centimes pour ce jour
  monthlyCapacity: number | null; // Capacité mensuelle en centimes pour ce jour
}

export async function getPspUsageTrend(
  pspId: string,
  days?: number,
  fromDate?: Date,
  toDate?: Date
): Promise<PspUsageTrendData[]> {
  const params = new URLSearchParams();
  if (days !== undefined && days !== null) {
    params.append('days', days.toString());
  }
  if (fromDate) {
    params.append('fromDate', fromDate.toISOString());
  }
  if (toDate) {
    params.append('toDate', toDate.toISOString());
  }
  const queryString = params.toString();
  return apiRequest(`/analytics/psp/${pspId}/usage-trend${queryString ? `?${queryString}` : ''}`);
}

export interface UpcomingFund {
  availableOn: string; // Date ISO (YYYY-MM-DD)
  currency: string;
  amount: number; // En centimes
  transactionCount: number;
}

export interface PspUpcomingFundsResponse {
  upcomingFunds: UpcomingFund[];
  currentBalance: {
    available: Array<{ currency: string; amount: number }>;
    pending: Array<{ currency: string; amount: number }>;
  } | null;
  pspType: string;
  fromCache: boolean;
  lastUpdated: string | null;
}

export async function getPspUpcomingFunds(pspId: string): Promise<PspUpcomingFundsResponse> {
  return apiRequest(`/analytics/psp/${pspId}/upcoming-funds`);
}

export async function getStoreAnalytics(storeId: string, period: 'day' | 'week' | 'month' = 'month'): Promise<StoreAnalytics> {
  return apiRequest(`/analytics/stores/${storeId}?period=${period}`);
}

export async function getStoreConversionFunnel(storeId: string, period: 'day' | 'week' | 'month' = 'month'): Promise<{
  store: { id: string; name: string; domain: string };
  funnel: {
    checkoutsInitiated: number;
    customerInfoProgress: number;
    customerInfoEntered: number;
    paymentInfoStarted: number;
    paymentInfoCompleted: number;
    payButtonClicked: number;
    paymentAttempted: number;
    paymentSuccessful: number;
  };
  conversionRates: {
    customerInfoRate: number;
    paymentStartRate: number;
    paymentCompleteRate: number;
    payButtonRate: number;
    paymentAttemptRate: number;
    finalConversionRate: number;
  };
}> {
  return apiRequest(`/analytics/stores/${storeId}/funnel?period=${period}`);
}

export async function getStoreDailyRevenue(storeId: string, days: number = 30): Promise<{
  data: Array<{
    date: string;
    revenue: number;
    successfulPayments: number;
    totalPayments: number;
  }>;
  summary: {
    totalRevenue: number;
    averageDailyRevenue: number;
    bestDay: { date: string; revenue: number };
    worstDay: { date: string; revenue: number };
  };
}> {
  return apiRequest(`/analytics/stores/${storeId}/daily-revenue?days=${days}`);
}

export async function getStoreApprovalRate(storeId: string, period: 'day' | 'week' | 'month' = 'month'): Promise<{
  global: {
    totalPayments: number;
    successfulPayments: number;
    failedPayments: number;
    approvalRate: number;
  };
  byPsp: Array<{
    pspId: string;
    pspName: string;
    totalPayments: number;
    successfulPayments: number;
    failedPayments: number;
    approvalRate: number;
  }>;
}> {
  return apiRequest(`/analytics/stores/${storeId}/approval-rate?period=${period}`);
}

export async function getStoreDailyCheckouts(storeId: string, days: number = 30): Promise<{
  data: Array<{
    date: string;
    checkoutsInitiated: number;
    customerInfoEntered: number;
    paymentSuccessful: number;
  }>;
  summary: {
    totalCheckouts: number;
    averageDailyCheckouts: number;
    bestDay: { date: string; checkouts: number };
    worstDay: { date: string; checkouts: number };
  };
}> {
  return apiRequest(`/analytics/stores/${storeId}/daily-checkouts?days=${days}`);
}

export async function getRealtime(): Promise<OverviewMetrics> {
  return apiRequest('/analytics/realtime');
}

// Server Actions pour Stores
export async function getAllStores(): Promise<Store[]> {
  return apiRequest('/store');
}

export async function getStoreById(id: string): Promise<Store> {
  return apiRequest(`/store/${id}`);
}

export async function createStore(data: CreateStoreData): Promise<Store> {
  return apiRequest('/store', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateStore(id: string, data: UpdateStoreData): Promise<Store> {
  return apiRequest(`/store/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteStore(id: string): Promise<void> {
  return apiRequest(`/store/${id}`, {
    method: 'DELETE',
  });
}

// Server Actions pour DNS
export async function verifyDnsRecord(hostname: string): Promise<{ success: boolean; error?: string }> {
  return apiRequest('/dns/verify', {
    method: 'POST',
    body: JSON.stringify({ hostname }),
  });
}

// Server Actions pour PSPs
export async function getAllPsps(): Promise<PSPWithStoreCount[]> {
  return apiRequest('/psp');
}

export async function getPspById(id: string): Promise<PSPWithStoreCount> {
  return apiRequest(`/psp/${id}`);
}

export async function getPspsByStore(storeId: string): Promise<StorePSP[]> {
  return apiRequest(`/psp/store/${storeId}`);
}

export async function createPsp(data: {
  name: string;
  pspType: string;
  publicKey: string;
  secretKey: string;
  monthlyCapacityEur?: number;
  dailyCapacityEur?: number;
  config?: Record<string, unknown>;
}): Promise<PSPWithStoreCount> {
  return apiRequest('/psp', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePsp(id: string, data: {
  name?: string;
  monthlyCapacityEur?: number;
  dailyCapacityEur?: number;
  isActive?: boolean;
  selfieVerified?: boolean;
}): Promise<PSPWithStoreCount> {
  return apiRequest(`/psp/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function updatePspCredentials(id: string, credentials: {
  publicKey?: string;
  secretKey?: string;
}): Promise<PSPWithStoreCount> {
  return apiRequest(`/psp/${id}/credentials`, {
    method: 'PUT',
    body: JSON.stringify(credentials),
  });
}

export async function deletePsp(id: string): Promise<void> {
  return apiRequest(`/psp/${id}`, {
    method: 'DELETE',
  });
}

export async function hardDeletePsp(id: string, force: boolean = false): Promise<void> {
  const url = force ? `/psp/${id}/hard?force=true` : `/psp/${id}/hard`;
  return apiRequest(url, {
    method: 'DELETE',
  });
}

export async function getPspPaymentCount(id: string): Promise<{ count: number }> {
  return apiRequest(`/psp/${id}/payment-count`);
}

export async function restorePsp(id: string): Promise<PSPWithStoreCount> {
  return apiRequest(`/psp/${id}/restore`, {
    method: 'POST',
  });
}

// Stripe Connect OAuth
export async function createStripeConnect(pspId: string, redirectUri: string): Promise<{ oauthUrl: string }> {
  return apiRequest(`/psp/${pspId}/stripe-connect/create`, {
    method: 'POST',
    body: JSON.stringify({ redirectUri }),
  });
}

export async function exchangeOAuthCode(code: string, pspId: string): Promise<{ status: string; stripeConnectedAccountId: string }> {
  return apiRequest('/psp/stripe-connect/oauth-callback', {
    method: 'POST',
    body: JSON.stringify({ code, state: pspId }),
  });
}

export async function getStripeConnectStatus(pspId: string): Promise<{ status: string; chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean }> {
  return apiRequest(`/psp/${pspId}/stripe-connect/status`);
}

// Server Actions pour StorePSP
export async function linkStorePsp(storeId: string, pspId: string): Promise<{ success: boolean }> {
  return apiRequest('/store-psp/link', {
    method: 'POST',
    body: JSON.stringify({ storeId, pspId }),
  });
}

export async function unlinkStorePsp(storeId: string, pspId: string): Promise<void> {
  return apiRequest('/store-psp/unlink', {
    method: 'DELETE',
    body: JSON.stringify({ storeId, pspId }),
  });
}

export async function getStorePsps(storeId: string): Promise<StorePSP[]> {
  return apiRequest(`/store-psp/store/${storeId}`);
}

// Server Actions pour PspList
export async function getAllPspLists(): Promise<PspList[]> {
  return apiRequest('/psp-list');
}

export async function getPspListById(id: string): Promise<PspList> {
  return apiRequest(`/psp-list/${id}`);
}

export async function createPspList(data: CreatePspListData): Promise<PspList> {
  return apiRequest('/psp-list', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePspList(id: string, data: UpdatePspListData): Promise<PspList> {
  return apiRequest(`/psp-list/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deletePspList(id: string): Promise<void> {
  return apiRequest(`/psp-list/${id}`, {
    method: 'DELETE',
  });
}

export async function addPspsToList(listId: string, pspIds: string[]): Promise<PspList> {
  return apiRequest(`/psp-list/${listId}/psps`, {
    method: 'POST',
    body: JSON.stringify({ pspIds }),
  });
}

export async function removePspFromList(listId: string, pspId: string): Promise<PspList> {
  return apiRequest(`/psp-list/${listId}/psps/${pspId}`, {
    method: 'DELETE',
  });
}

export async function linkPspListToStore(storeId: string, listId: string): Promise<{
  listId: string;
  listName: string;
  linkedCount: number;
  totalPsps: number;
  links: Array<{
    id: string;
    storeId: string;
    pspId: string;
    createdAt: string;
    updatedAt: string;
    psp: {
      id: string;
      name: string;
      pspType: string;
    };
    store: {
      id: string;
      name: string;
      domain: string;
    };
  }>;
}> {
  return apiRequest('/store-psp/link-list', {
    method: 'POST',
    body: JSON.stringify({ storeId, listId }),
  });
}

// Server Actions pour Orders
export async function getAllOrders(): Promise<Record<string, unknown>[]> {
  return apiRequest('/order');
}

export async function getOrderById(id: string): Promise<Record<string, unknown>> {
  return apiRequest(`/order/${id}`);
}

// Server Actions pour Payments
export async function getAllPayments(params?: {
  page?: number; limit?: number; status?: string; storeId?: string; storeIds?: string[]; pspId?: string
}): Promise<PaginatedPayments> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.append('page', params.page.toString())
  if (params?.limit) searchParams.append('limit', params.limit.toString())
  if (params?.status) searchParams.append('status', params.status)
  if (params?.storeId) searchParams.append('storeId', params.storeId)
  else if (params?.storeIds && params.storeIds.length > 0) searchParams.append('storeIds', params.storeIds.join(','))
  if (params?.pspId) searchParams.append('pspId', params.pspId)
  const queryString = searchParams.toString()
  return apiRequest(`/payment${queryString ? `?${queryString}` : ''}`);
}

export async function getPaymentById(id: string): Promise<Record<string, unknown>> {
  return apiRequest(`/payment/${id}`);
}

// Server Actions pour Routing
export async function getRoutingConfig(storeId: string): Promise<Record<string, unknown>> {
  return apiRequest(`/routing/store/${storeId}`);
}

export async function updateRoutingConfig(storeId: string, config: {
  mode: 'AUTOMATIC' | 'MANUAL';
  fallbackEnabled: boolean;
  maxRetries: number;
  weights?: Array<{ pspId: string; weight: number }>;
  fallbackSequence?: Array<{ pspId: string; order: number }>;
}): Promise<Record<string, unknown>> {
  return apiRequest(`/routing/store/${storeId}`, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

export async function updateRoutingWeights(storeId: string, weights: Array<{ pspId: string; weight: number }>): Promise<Record<string, unknown>> {
  return apiRequest(`/routing/store/${storeId}/weights`, {
    method: 'PUT',
    body: JSON.stringify(weights),
  });
}

export async function updateRoutingFallback(storeId: string, sequence: Array<{ pspId: string; order: number }>): Promise<Record<string, unknown>> {
  return apiRequest(`/routing/store/${storeId}/fallback`, {
    method: 'PUT',
    body: JSON.stringify(sequence),
  });
}

// ===== WooCommerce =====

export async function generateWooCommerceOAuthUrl(data: {
  domain: string;
  storeId: string;
  accountId: string;
}): Promise<{ success: boolean; oauthUrl?: string; error?: string }> {
  return apiRequest('/woocommerce/oauth/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getWooCommerceCredentials(storeId: string): Promise<Store> {
  return apiRequest(`/store/${storeId}`);
}

// ===== Shopify OAuth =====

export async function generateShopifyOAuthUrl(storeId: string): Promise<{ success: boolean; oauthUrl?: string; error?: string }> {
  return apiRequest('/shopify/oauth/generate', {
    method: 'POST',
    body: JSON.stringify({ storeId }),
  });
}

export async function getShopifyOAuthStatus(storeId: string): Promise<{
  connected: boolean;
  shopifyId: string | null;
}> {
  return apiRequest(`/shopify/oauth/status/${storeId}`);
}

// Server Actions pour Meta Conversion API
export async function getMetaSettings(storeId: string): Promise<{
  id: string;
  metaPixelId: string | null;
  metaAccessToken: string | null;
  metaNewCustomersOnly: boolean;
}> {
  return apiRequest(`/store/${storeId}/meta-settings`);
}

export async function updateMetaSettings(
  storeId: string,
  settings: {
    metaPixelId?: string | null;
    metaAccessToken?: string | null;
    metaNewCustomersOnly?: boolean;
  }
): Promise<{
  id: string;
  metaPixelId: string | null;
  metaNewCustomersOnly: boolean;
}> {
  return apiRequest(`/store/${storeId}/meta-settings`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// Server Actions pour TikTok Pixel
export async function getTiktokSettings(storeId: string): Promise<{
  id: string;
  tiktokPixelId: string | null;
}> {
  return apiRequest(`/store/${storeId}/tiktok-settings`);
}

export async function updateTiktokSettings(
  storeId: string,
  settings: {
    tiktokPixelId?: string | null;
  }
): Promise<{
  id: string;
  tiktokPixelId: string | null;
}> {
  return apiRequest(`/store/${storeId}/tiktok-settings`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export async function authenticateWithToken(token: string) {
  const expectedToken = process.env.DASHBOARD_ACCESS_TOKEN
  
  if (!expectedToken) {
    throw new Error("Token d'accès non configuré")
  }
  
  if (token === expectedToken) {
    // Créer un cookie de session pour maintenir l'authentification
    const cookieStore = await cookies()
    cookieStore.set("dashboard-auth", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7, // 7 jours
    })
    
    return { success: true }
  } else {
    throw new Error("Token invalide")
  }
}

export async function checkAuthStatus() {
  const cookieStore = await cookies()
  const authCookie = cookieStore.get("dashboard-auth")
  
  if (authCookie?.value === "authenticated") {
    return { isAuthenticated: true }
  }
  
  return { isAuthenticated: false }
}

export async function requireAuth() {
  const { isAuthenticated } = await checkAuthStatus()
  
  if (!isAuthenticated) {
    redirect("/login")
  }
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete("dashboard-auth")
  redirect("/login")
}

export async function redirectIfAuthenticated() {
  const { isAuthenticated } = await checkAuthStatus()
  
  if (isAuthenticated) {
    redirect("/")
  }
}



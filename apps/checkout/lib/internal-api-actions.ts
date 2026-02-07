'use server'

// Configuration de l'API interne
const API_BASE_URL = process.env.INTERNAL_API_URL || 'http://localhost:5000'

// Import des types depuis le fichier types
import type { Cart, Store, PaymentIntentResponse, CheckoutInfo, Order } from './types'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    const data = await response.json()

    if (!response.ok) {
      // Si l'API retourne une erreur avec un message spécifique, l'utiliser
      if (data && data.error) {
        throw new ApiError(response.status, data.error)
      }
      throw new ApiError(response.status, `API Error: ${response.status} ${response.statusText}`)
    }

    return data
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError(0, `Impossible de se connecter à l'API (${url}). Vérifiez que l'API est démarrée.`)
    }
    throw error
  }
}

// Actions pour les stores
export async function getStoreByPayDomain(payDomain: string): Promise<{ success: boolean; domain?: string; storeId?: string; error?: string }> {
  try {
    return await apiRequest(`/store/domain/${payDomain}`)
  } catch (error) {
    console.error('Erreur lors de la récupération du store:', error)
    return {
      success: false,
      error: 'Impossible de récupérer les informations du store',
    }
  }
}

export async function getStoreById(storeId: string): Promise<Store | null> {
  try {
    return await apiRequest(`/store/${storeId}`)
  } catch (error) {
    console.error('Erreur lors de la récupération du store:', error)
    return null
  }
}

// Actions pour les paniers (via Shopify)
export async function getShopifyCart(cartId: string, storeId: string): Promise<Cart | null> {
  try {
    // L'API interne gère la récupération des paniers Shopify
    const response = await apiRequest<{ success: boolean; cart?: Cart }>(`/shopify/cart/${encodeURIComponent(cartId)}?storeId=${storeId}`)
    return response.success ? response.cart || null : null
  } catch (error) {
    console.error('Erreur lors de la récupération du panier Shopify:', error)
    return null
  }
}

// Actions pour les paiements
export async function createPaymentIntent(
  amount: number,
  currency: string = 'usd',
  customerEmail: string,
  storeId?: string
): Promise<PaymentIntentResponse> {
  try {
    return await apiRequest('/payment/create-intent', {
      method: 'POST',
      body: JSON.stringify({
        amount,
        currency,
        customerEmail,
        storeId,
      }),
    })
  } catch (error) {
    console.error('Erreur lors de la création du Payment Intent:', error)
    return {
      success: false,
      error: 'Impossible de créer le paiement',
    }
  }
}

export async function createPaymentFromCart(
  checkoutId: string,
  customerData?: {
    email?: string
    name?: string
    phone?: string
    address?: {
      line1?: string
      line2?: string
      city?: string
      postal_code?: string
      country?: string
      state?: string
    }
  },
  referer?: string,
  isExpressCheckout?: boolean
): Promise<PaymentIntentResponse> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (referer) {
      headers['referer'] = referer
    }

    return await apiRequest('/payment/from-checkout', {
      method: 'POST',
      headers,
      body: JSON.stringify({ checkoutId, customerData, isExpressCheckout }),
    })
  } catch (error) {
    console.error('Erreur lors de la création du paiement depuis le checkout:', error)
    return {
      success: false,
      error: 'Impossible de créer le paiement',
    }
  }
}

export async function confirmPayment(
  paymentIntentId: string,
  customerData?: {
    email?: string
    name?: string
    phone?: string
    address?: {
      line1?: string
      line2?: string
      city?: string
      postal_code?: string
      country?: string
      state?: string
    }
  }
): Promise<PaymentIntentResponse> {
  try {
    const requestBody = {
      paymentIntentId,
      customerEmail: customerData?.email,
      customerName: customerData?.name,
      customerPhone: customerData?.phone,
      customerAddress: customerData?.address,
    }
    

    
    return await apiRequest('/payment/confirm', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })
  } catch (error) {
    console.error('Erreur lors de la confirmation du paiement:', error)
    return {
      success: false,
      error: 'Erreur lors de la confirmation du paiement',
    }
  }
}

export async function retryPayment(
  previousPaymentIntentId: string,
  checkoutId: string,
  lastErrorCode?: string,
  storeId?: string,
  currency?: string,
): Promise<PaymentIntentResponse> {
  try {
    return await apiRequest('/payment/retry', {
      method: 'POST',
      body: JSON.stringify({
        previousPaymentIntentId,
        checkoutId,
        lastErrorCode,
        storeId,
        currency,
      }),
    })
  } catch (error) {
    console.error('Erreur lors du retry du paiement:', error)
    return {
      success: false,
      error: 'Impossible de relancer le paiement',
    }
  }
}

export async function getOrderData(paymentIntentId: string): Promise<{ success: boolean; order?: Order; error?: string }> {
  try {
    return await apiRequest(`/payment/order/${paymentIntentId}`)
  } catch (error) {
    console.error('Erreur lors de la récupération des données de commande:', error)
    return {
      success: false,
      error: 'Impossible de récupérer les données de commande',
    }
  }
}

// Actions pour les informations de checkout
export async function getCheckoutInfo(checkoutId: string, domain?: string): Promise<CheckoutInfo> {
  try {
    const url = new URL(`${API_BASE_URL}/checkout/${checkoutId}`)
    if (domain) {
      url.searchParams.set('domain', domain)
    }

    const response = await apiRequest<{ success: boolean; checkout?: { store: Store; cart: Cart } }>(url.pathname + url.search)

    if (response.success && response.checkout) {
      return {
        success: true,
        store: response.checkout.store,
        cart: response.checkout.cart,
      }
    }

    return {
      success: false,
      error: 'Données de checkout invalides',
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des informations de checkout:', error)
    
    // Gérer les erreurs spécifiques
    if (error instanceof ApiError) {
      if (error.status === 410 || error.message === 'CHECKOUT_EXPIRED') {
        return {
          success: false,
          error: 'CHECKOUT_EXPIRED',
        }
      } else if (error.status === 404) {
        return {
          success: false,
          error: 'Checkout non trouvé',
        }
      }
    }
    
    return {
      success: false,
      error: 'Impossible de récupérer les informations de checkout',
    }
  }
}

// Actions pour les commandes
export async function getOrderById(orderId: string): Promise<Order | null> {
  try {
    return await apiRequest(`/order/${orderId}`)
  } catch (error) {
    console.error('Erreur lors de la récupération de la commande:', error)
    return null
  }
}

// Fonction utilitaire pour gérer le succès de paiement
export async function handlePaymentSuccess(
  paymentIntentId: string,
  customerData?: {
    email?: string
    name?: string
    phone?: string
    address?: {
      line1?: string
      line2?: string
      city?: string
      postal_code?: string
      country?: string
      state?: string
    }
  }
): Promise<{ success: boolean; orderId?: string; order?: Order; shopifyOrder?: Record<string, unknown>; error?: string }> {
  try {
    const result = await confirmPayment(paymentIntentId, customerData)
    
    if (result.success) {
  
      return {
        success: true,
        orderId: result.order?.id,
        order: result.order,
        shopifyOrder: result.shopifyOrder
      }
    }

    return result
  } catch (error) {
    console.error('Erreur lors du traitement du succès:', error)
    return {
      success: false,
      error: 'Erreur lors du traitement du paiement',
    }
  }
}

export async function getPublishableKey(checkoutId: string): Promise<{ success: boolean; publishableKey?: string; error?: string }> {
  try {
    return await apiRequest(`/payment/checkout/${checkoutId}/publishable-key`)
  } catch (error) {
    console.error('Erreur lors de la récupération de la clé publique:', error)
    return {
      success: false,
      error: 'Impossible de récupérer la clé publique',
    }
  }
}

// ── Basis Theory + Connect Actions ──────────────────────────────────

export async function createPaymentBT(
  checkoutId: string,
  tokenIntentId: string,
  customerData?: {
    email?: string
    name?: string
    phone?: string
    address?: {
      line1?: string
      line2?: string
      city?: string
      postal_code?: string
      country?: string
      state?: string
    }
  }
): Promise<PaymentIntentResponse> {
  try {
    return await apiRequest('/payment/from-checkout-bt', {
      method: 'POST',
      body: JSON.stringify({ checkoutId, tokenIntentId, customerData }),
    })
  } catch (error) {
    console.error('Erreur lors de la création du paiement BT:', error)
    return {
      success: false,
      error: 'Impossible de créer le paiement',
    }
  }
}

export async function confirmPaymentBT(
  paymentIntentId: string,
  customerData?: {
    email?: string
    name?: string
    phone?: string
    address?: {
      line1?: string
      line2?: string
      city?: string
      postal_code?: string
      country?: string
      state?: string
    }
  }
): Promise<PaymentIntentResponse> {
  try {
    return await apiRequest('/payment/confirm-bt', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId, customerData }),
    })
  } catch (error) {
    console.error('Erreur lors de la confirmation du paiement BT:', error)
    return {
      success: false,
      error: 'Erreur lors de la confirmation du paiement',
    }
  }
}

export async function getOrCreatePaymentIntent(checkoutId: string): Promise<PaymentIntentResponse> {
  try {
    return await apiRequest(`/payment/checkout/${checkoutId}/payment-intent`)
  } catch (error) {
    console.error('Erreur lors de la récupération/création du Payment Intent:', error)
    return {
      success: false,
      error: 'Impossible de récupérer ou créer le Payment Intent',
    }
  }
}

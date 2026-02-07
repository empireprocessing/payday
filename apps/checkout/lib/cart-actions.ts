'use server'

// Import des nouvelles actions de l'API interne
import {
  getShopifyCart as getShopifyCartInternal,
  createPaymentFromCart as createPaymentFromCartInternal,
  getCheckoutInfo as getCheckoutInfoInternal,
  getOrCreatePaymentIntent as getOrCreatePaymentIntentInternal,
  getPublishableKey as getPublishableKeyInternal,
} from './internal-api-actions'

// Import des types depuis le fichier types
import type { Cart, CheckoutInfo, PaymentIntentResponse } from './types'

// Re-export du type PaymentConfig pour compatibilité
export type PaymentConfig = PaymentIntentResponse

// Fonction pour construire le GID Shopify complet
function buildShopifyCartGid(cartId: string): string {
  // Si c'est déjà un GID complet, le retourner tel quel
  if (cartId.startsWith('gid://shopify/Cart/')) {
    return cartId
  }
  
  // Sinon, construire le GID à partir de l'ID court
  return `gid://shopify/Cart/${cartId}`
}

// Fonction principale pour récupérer un panier
export async function getCartById(cartId: string, storeId?: string): Promise<Cart | null> {
  // Construire le GID Shopify complet
  const shopifyGid = buildShopifyCartGid(cartId)
  
  if (storeId) {
    // Utiliser l'API interne pour récupérer le panier Shopify
    try {
      const cart = await getShopifyCartInternal(shopifyGid, storeId)
      if (cart) {
        return cart
      }
    } catch (error) {
      // Fallback to checkout-info API
    }
  }

  // Fallback: essayer de récupérer via checkout-info qui peut détecter le store
  try {
    const checkoutInfo = await getCheckoutInfoInternal(cartId)
    if (checkoutInfo.success && checkoutInfo.cart) {
      return checkoutInfo.cart
    }
  } catch (error) {
    console.error('Erreur lors de la récupération du panier via checkout-info:', error)
  }

  return null
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
): Promise<PaymentConfig> {
  return createPaymentFromCartInternal(checkoutId, customerData, referer, isExpressCheckout)
}

export async function getPublishableKey(checkoutId: string): Promise<{ success: boolean; publishableKey?: string; error?: string }> {
  return getPublishableKeyInternal(checkoutId)
}

export async function getOrCreatePaymentIntent(checkoutId: string): Promise<PaymentConfig> {
  return getOrCreatePaymentIntentInternal(checkoutId)
}

// Fonction pour récupérer les informations de checkout (store + cart)
export async function getCheckoutInfo(checkoutId: string, domain?: string): Promise<CheckoutInfo> {
  return getCheckoutInfoInternal(checkoutId, domain)
}

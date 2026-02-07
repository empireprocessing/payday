'use server'

// Import des nouvelles actions de l'API interne
import {
    createPaymentIntent as createPaymentIntentInternal,
    confirmPayment as confirmPaymentInternal,
    retryPayment as retryPaymentInternal,
    getOrderData as getOrderDataInternal,
    handlePaymentSuccess as handlePaymentSuccessInternal,
} from './internal-api-actions'

// Import des types depuis le fichier types
import type { PaymentIntentResponse, Order } from './types'

// Re-export des types pour compatibilité
export type { PaymentIntentResponse }

export async function createPaymentIntent(
  amount: number, 
  currency: string = 'usd',
  customerEmail: string,
  storeId?: string
): Promise<PaymentIntentResponse> {
  return createPaymentIntentInternal(amount, currency, customerEmail, storeId)
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
  return confirmPaymentInternal(paymentIntentId, customerData)
}

export async function retryPayment(
  previousPaymentIntentId: string,
  cartId: string,
  lastErrorCode?: string,
  storeId?: string,
  currency?: string,
): Promise<PaymentIntentResponse> {
  return retryPaymentInternal(previousPaymentIntentId, cartId, lastErrorCode, storeId, currency)
}

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
  return handlePaymentSuccessInternal(paymentIntentId, customerData)
}

export async function getOrderData(paymentIntentId: string): Promise<{ success: boolean; order?: Order; error?: string }> {
  return getOrderDataInternal(paymentIntentId)
}



import { PaymentStatus } from '@prisma/client'

export interface CreatePaymentIntentDto {
  amount: number
  currency?: string
  customerEmail: string
  storeId?: string
}

export interface RecordPaymentAttemptDto {
  orderId: string | null
  storeId: string
  pspId: string
  pspPaymentId?: string
  pspIntentId?: string
  amount: number
  currency?: string
  status: PaymentStatus
  pspMetadata?: any
  failureReason?: string
  attemptNumber?: number
  isFallback?: boolean
  processingTimeMs?: number | null
}

export interface CartLimitExceeded {
  currentAmount: number
  maxAmount: number
  currency: string
  suggestions: Array<{ id: string; name: string; quantity: number; unitPrice: number }> | null
  newTotalAfterRemoval?: number
  message?: string
}

export interface PaymentIntentResponse {
  success: boolean
  clientSecret?: string
  paymentIntentId?: string
  publishableKey?: string // Clé publique pour le frontend, sans révéler quel PSP
  status?: string // PaymentIntent status (succeeded, requires_action, requires_confirmation, etc.)
  attempts?: Array<{ pspId: string; pspType: string; attemptNumber: number; isFallback: boolean }>
  error?: string
  cartLimitExceeded?: CartLimitExceeded // Limite de panier dépassée avec suggestions
}

export interface RetryPaymentDto {
  previousPaymentIntentId: string
  cartId: string
  lastErrorCode?: string
  storeId?: string
  currency?: string
}

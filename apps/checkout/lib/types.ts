// Types pour l'application checkout
export interface CartItem {
  id: string
  productId: string
  variantId: string
  name: string
  variantTitle?: string
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
  image?: string
}

export interface Cart {
  id: string
  storeId: string
  storeName: string
  customerEmail?: string
  items: CartItem[]
  subtotal: number
  shippingCost: number
  totalAmount: number
  currency: string
  createdAt: string
  updatedAt: string
}

export interface Store {
  id: string
  name: string
  domain: string
  payDomain: string
  logoUrl?: string
  supportEmail?: string
  shopifyId: string
  requiresShipping?: boolean
  metaPixelId?: string | null
  tiktokPixelId?: string | null
  // Address section title (e.g., "Livraison" or "Facturation")
  addressSectionTitle?: string | null
  // Shipping display config
  shippingMethodTitle?: string | null      // Default: "Livraison standard"
  shippingMethodSubtitle?: string | null   // Default: "Entre le {{minDate}} et le {{maxDate}}"
  shippingMinDays?: number                 // Default: 1
  shippingMaxDays?: number                 // Default: 2
  // Trust badges (icon can be emoji, imageUrl is optional image URL)
  trustBadges?: Array<{ icon: string; imageUrl?: string; title: string; subtitle: string }> | null
  // Trustpilot widget config
  trustpilotEnabled?: boolean
  trustpilotRating?: number | null
  trustpilotReviewCount?: number | null
  trustpilotUrl?: string | null
  // Checkout config (language, theme, etc.)
  checkoutConfig?: any | null
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
  publishableKey?: string
  orderId?: string
  order?: Order
  shopifyOrder?: Record<string, unknown>
  pspUsed?: {
    priority: number
    type: string
    publicKey: string
  }
  error?: string
  cartLimitExceeded?: CartLimitExceeded
  // BT + Connect fields
  status?: string // 'succeeded' | 'requires_action'
  platformPublishableKey?: string // For 3DS handleNextAction
  stripeConnectedAccountId?: string // For 3DS handleNextAction
}

export interface CheckoutInfo {
  success: boolean
  store?: Store
  cart?: Cart
  error?: string
}

export interface Order {
  id: string
  storeId: string
  customerEmail: string
  subtotal: number
  shippingCost: number
  totalAmount: number
  currency: string
  paymentStatus: string
  items: Array<{
    id: string
    productId: string
    quantity: number
    unitPrice: number
    totalPrice: number
    name: string
    description?: string
    image?: string
  }>
  createdAt: string
  updatedAt: string
}

export type PaymentConfig = PaymentIntentResponse

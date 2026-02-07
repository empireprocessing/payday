
export interface CreateOrderDto {
  storeId: string
  customerEmail: string
  subtotal: number
  shippingCost: number
  totalAmount: number
  currency?: string
  items: Array<{
    productId?: string // Optionnel maintenant
    quantity: number
    unitPrice: number
    name: string
    description?: string
    image?: string
  }>
}

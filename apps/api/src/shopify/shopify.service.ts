import { Injectable, Logger } from '@nestjs/common'

export interface ShopifyOrderData {
  email: string
  name: string
  phone?: string
  address: {
    line1: string
    line2?: string
    city: string
    postal_code: string
    country: string
    state: string
  }
  cartId: string
  paymentIntentId: string
  paymentMethod?: 'card' | 'express_checkout'
}

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

@Injectable()
export class ShopifyService {
  private readonly logger = new Logger(ShopifyService.name)
  private static readonly API_VERSION = '2025-10'

  private baseUrl(path: string, shopDomain: string) {
    return `https://${shopDomain}/admin/api/${ShopifyService.API_VERSION}${path}`
  }

  private storefrontUrl(shopDomain: string) {
    return `https://${shopDomain}/api/${ShopifyService.API_VERSION}/graphql.json`
  }

  /**
   * Format phone number to E.164 format required by Shopify
   * Converts "0033618421113" to "+33618421113"
   */
  private formatPhoneForShopify(phone: string | undefined): string {
    if (!phone) return ''
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '')
    // Convert 00XX... to +XX...
    if (cleaned.startsWith('00')) {
      cleaned = '+' + cleaned.slice(2)
    }
    // If it doesn't start with +, assume it's a local number and return as-is
    // Shopify will validate it
    return cleaned
  }

  /**
   * Récupère un cart Shopify via Storefront API
   */
  async getShopifyCart(cartId: string, shopifyId?: string): Promise<Cart | null> {
    try {
      if (!shopifyId) {
        throw new Error('shopifyId is required to resolve shop domain')
      }
      const resolvedDomain = `${shopifyId}.myshopify.com`

      console.log('🔍 getShopifyCart called with:', {
        cartId,
        shopifyId,
        resolvedDomain
      })

      const query = `
        query GetCart($cartId: ID!) {
          cart(id: $cartId) {
            id
            createdAt
            updatedAt
            lines(first: 250) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price {
                        amount
                        currencyCode
                      }
                      product {
                        title
                        description
                      }
                      image {
                        url
                        altText
                      }
                    }
                  }
                }
              }
            }
            estimatedCost {
              totalAmount {
                amount
                currencyCode
              }
              subtotalAmount {
                amount
                currencyCode
              }
            }
          }
        }
      `

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      const url = this.storefrontUrl(resolvedDomain)
      console.log('📡 Fetching Shopify cart from:', url)
      console.log('📋 Headers:', Object.keys(headers))

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          variables: { cartId }
        }),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      console.log('📥 Shopify response status:', response.status, response.statusText)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const responseData = await response.json()
      console.log('📦 Shopify response data:', JSON.stringify(responseData, null, 2))

      const { data, errors } = responseData

      if (errors) {
        console.error('❌ GraphQL errors:', JSON.stringify(errors, null, 2))
        return null
      }

      if (!data?.cart) {
        console.error('❌ No cart data in response')
        return null
      }

      console.log('✅ Cart retrieved successfully:', data.cart.id)

      const shopifyCart = data.cart

      // Transformer les données Shopify vers notre interface Cart
      const cart: Cart = {
        id: shopifyCart.id,
        storeId: 'shopify-store',
        storeName: 'Shopify Store',
        items: shopifyCart.lines.edges.map((edge: any) => {
          const line = edge.node
          const merchandise = line.merchandise
          const unitPrice = parseFloat(merchandise.price.amount)
          
          return {
            id: line.id,
            productId: merchandise.product ? merchandise.product.title : merchandise.id,
            variantId: merchandise.id,
            name: merchandise.product ? merchandise.product.title : 'Produit',
            variantTitle: merchandise.title,
            description: merchandise.title && merchandise.title !== 'Default Title' ? merchandise.title : '',
            quantity: line.quantity,
            unitPrice,
            totalPrice: unitPrice * line.quantity,
            image: merchandise.image?.url || undefined,
          }
        }),
        subtotal: parseFloat(shopifyCart.estimatedCost.subtotalAmount?.amount || shopifyCart.estimatedCost.totalAmount.amount),
        shippingCost: 0,
        totalAmount: parseFloat(shopifyCart.estimatedCost.totalAmount.amount),
        currency: shopifyCart.estimatedCost.totalAmount.currencyCode,
        createdAt: shopifyCart.createdAt,
        updatedAt: shopifyCart.updatedAt,
      }

      console.log('✅ Shopify cart retrieved successfully:', {
        items: cart.items.length,
        total: cart.totalAmount,
        currency: cart.currency
      })
      return cart
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        console.error('❌ Timeout retrieving Shopify cart (10s exceeded):', {
          cartId,
          shopifyId,
          error: error.message
        })
      } else {
        console.error('❌ Error retrieving Shopify cart:', {
          cartId,
          shopifyId,
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack
        })
      }
      return null
    }
  }

  /**
   * Create a Shopify order already marked as PAID using REST API
   */
  async createPaidOrder(orderData: ShopifyOrderData, opts: { shopDomain: string; accessToken: string }): Promise<any> {
    try {
      if (!opts?.shopDomain || !opts?.accessToken) {
        throw new Error('Shop domain or access token not provided')
      }

      console.log('🏪 Creating paid Shopify order for shop:', opts.shopDomain)

      // Récupérer le cart Shopify avec les vrais produits
      const shopifyId = opts.shopDomain.endsWith('.myshopify.com')
        ? opts.shopDomain.slice(0, -'.myshopify.com'.length)
        : opts.shopDomain
      const cart = await this.getShopifyCart(orderData.cartId, shopifyId)
      if (!cart) {
        throw new Error(`Cart not found: ${orderData.cartId}`)
      }

      console.log('🛒 Using cart data:', cart.items.length, 'items, total:', cart.totalAmount, cart.currency)

      // Convertir les items du cart en line_items Shopify
      const line_items = cart.items.map(item => {
        // Extraire l'ID numérique du variant depuis le GID
        const variantIdMatch = item.variantId.match(/ProductVariant\/(\d+)/)
        const variantId = variantIdMatch ? parseInt(variantIdMatch[1]) : null

        if (!variantId) {
          console.warn('⚠️ Could not extract variant ID from:', item.variantId)
        }

        return {
          variant_id: variantId,
          quantity: item.quantity,
          // Laisser Shopify utiliser ses propres prix
          title: item.name,
        }
      })

      // Formater le montant de la transaction en décimal
      const transactionAmount = (cart.totalAmount).toFixed(2)

      // Format phone to E.164 for Shopify
      const formattedPhone = this.formatPhoneForShopify(orderData.phone)

      const body = {
        order: {
          email: orderData.email,
          phone: formattedPhone,
          currency: cart.currency,
          line_items,
          // Mark order as paid at creation
          financial_status: 'paid',
          // Customer info
          customer: {
            email: orderData.email,
            phone: formattedPhone,
            first_name: orderData.name.split(' ')[0] || orderData.name,
            last_name: orderData.name.split(' ').slice(1).join(' ') || '',
          },
          // Free shipping
          shipping_lines: [
            {
              title: 'Free shipping',
              price: '0.00',
              code: 'FREE',
            },
          ],
          // Addresses
          shipping_address: {
            first_name: orderData.name.split(' ')[0] || orderData.name,
            last_name: orderData.name.split(' ').slice(1).join(' ') || '',
            address1: orderData.address.line1,
            address2: orderData.address.line2 || '',
            city: orderData.address.city,
            province: orderData.address.state,
            zip: orderData.address.postal_code,
            country: orderData.address.country,
            phone: formattedPhone,
          },
          billing_address: {
            first_name: orderData.name.split(' ')[0] || orderData.name,
            last_name: orderData.name.split(' ').slice(1).join(' ') || '',
            address1: orderData.address.line1,
            address2: orderData.address.line2 || '',
            city: orderData.address.city,
            province: orderData.address.state,
            zip: orderData.address.postal_code,
            country: orderData.address.country,
            phone: formattedPhone,
          },
          // Créer la transaction en même temps que la commande
          transactions: [
            {
              kind: 'sale',
              status: 'success',
              amount: transactionAmount,
              currency: cart.currency.toUpperCase(),
              gateway: orderData.paymentMethod === 'express_checkout' ? 'Apple Pay / Google Pay' : 'Card',
              source: 'external',
            }
          ],
          // Inventory behavior
          inventory_behaviour: 'decrement_obeying_policy',
          // Envoyer le reçu maintenant que la transaction est incluse
          send_receipt: true,
          send_fulfillment_receipt: false,
        },
      }

      const headers = {
        'X-Shopify-Access-Token': opts.accessToken,
        'Content-Type': 'application/json',
      }

      const url = this.baseUrl('/orders.json', opts.shopDomain)

      console.log('📝 Creating paid order with data:', JSON.stringify(body, null, 2))

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.text()
        this.logger.error(`Shopify order create failed: ${response.status} ${errorData}`)
        throw new Error(`Shopify order creation failed: ${response.status} ${errorData}`)
      }

      const responseData = await response.json()
      const order = responseData.order

      console.log('✅ Shopify order created:', order?.id, order?.name, `(${order?.financial_status})`)
      const gatewayName = orderData.paymentMethod === 'express_checkout' ? 'Apple Pay / Google Pay' : 'Card'
      console.log('✅ Transaction créée: sale', transactionAmount, cart.currency.toUpperCase(), 'via', gatewayName)

      return order
    } catch (error) {
      console.error('❌ Error creating paid Shopify order:', error)
      throw error
    }
  }

  /**
   * Create a transaction for a Shopify order
   */
  async createTransaction(
    orderId: string,
    transactionData: {
      kind: 'sale' | 'capture' | 'authorization' | 'refund' | 'void'
      status: 'pending' | 'success' | 'failure' | 'error'
      amount: string
      currency: string
      gateway: string
      source?: string
    },
    opts: { shopDomain: string; accessToken: string }
  ): Promise<any> {
    try {
      if (!opts?.shopDomain || !opts?.accessToken) {
        throw new Error('Shop domain or access token not provided')
      }

      const body = {
        transaction: transactionData,
      }

      const headers = {
        'X-Shopify-Access-Token': opts.accessToken,
        'Content-Type': 'application/json',
      }

      const url = this.baseUrl(`/orders/${orderId}/transactions.json`, opts.shopDomain)

      console.log('💳 Creating Shopify transaction:', JSON.stringify(body, null, 2))

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.text()
        this.logger.error(`Shopify transaction create failed: ${response.status} ${errorData}`)
        throw new Error(`Shopify transaction creation failed: ${response.status} ${errorData}`)
      }

      const responseData = await response.json()
      console.log('✅ Shopify transaction created:', responseData.transaction?.id)

      return responseData.transaction
    } catch (error) {
      console.error('❌ Error creating Shopify transaction:', error)
      throw error
    }
  }

  /**
   * Send order receipt email to customer
   */
  async sendOrderReceipt(orderId: string, opts: { shopDomain: string; accessToken: string }): Promise<any> {
    try {
      if (!opts?.shopDomain || !opts?.accessToken) {
        throw new Error('Shop domain or access token not provided')
      }

      const headers = {
        'X-Shopify-Access-Token': opts.accessToken,
        'Content-Type': 'application/json',
      }

      // L'endpoint pour envoyer la confirmation de commande (reçu)
      const url = this.baseUrl(`/orders/${orderId}/order_confirmations.json`, opts.shopDomain)

      console.log('📧 Envoi du reçu Shopify pour la commande:', orderId)

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({}), // Corps vide requis par l'API
      })

      if (!response.ok) {
        const errorData = await response.text()
        this.logger.error(`Shopify send receipt failed: ${response.status} ${errorData}`)
        throw new Error(`Shopify send receipt failed: ${response.status} ${errorData}`)
      }

      console.log('✅ Reçu Shopify envoyé avec succès')
      return true
    } catch (error) {
      console.error('❌ Error sending Shopify order receipt:', error)
      throw error
    }
  }

  /**
   * Create a Shopify order using REST API (legacy method for compatibility)
   */
  async createOrder(orderData: ShopifyOrderData, opts: { shopDomain: string; accessToken: string }): Promise<any> {
    // Just call the new createPaidOrder method
    return this.createPaidOrder(orderData, opts)
  }

  /**
   * Get order by ID using REST API
   */
  async getOrder(shopifyOrderId: string, opts: { shopDomain: string; accessToken: string }): Promise<any> {
    try {
      if (!opts?.shopDomain || !opts?.accessToken) {
        throw new Error('Shop domain or access token not provided')
      }

      const headers = {
        'X-Shopify-Access-Token': opts.accessToken,
        'Content-Type': 'application/json',
      }

      const url = this.baseUrl(`/orders/${shopifyOrderId}.json`, opts.shopDomain)

      const response = await fetch(url, {
        method: 'GET',
        headers,
      })

      if (!response.ok) {
        const errorData = await response.text()
        this.logger.error(`Shopify get order failed: ${response.status} ${errorData}`)
        throw new Error(`Failed to get Shopify order: ${response.status} ${errorData}`)
      }

      const responseData = await response.json()
      return responseData.order
    } catch (error) {
      console.error('❌ Error getting Shopify order:', error)
      throw error
    }
  }
}

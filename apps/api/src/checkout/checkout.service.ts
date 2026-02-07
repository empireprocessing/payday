import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ShopifyService } from '../shopify/shopify.service';
import { StoreService } from '../store/store.service';
import { CheckoutEventsService } from './checkout-events.service';
import { WoocommerceService } from '../woocommerce/woocommerce.service';
import { generateShopifyLikeId } from '../common/id-generator';

export interface CreateCheckoutResponse {
  success: boolean;
  checkoutId?: string;
  error?: string;
}

export interface GetCheckoutResponse {
  success: boolean;
  checkout?: any;
  error?: string;
}

// Helper pour extraire shopifyId depuis platformConfig
function getShopifyId(store: any): string | null {
  if (store.platform === 'SHOPIFY' && store.platformConfig) {
    return (store.platformConfig as any).shopifyId || null;
  }
  return null;
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shopifyService: ShopifyService,
    private readonly storeService: StoreService,
    private readonly checkoutEventsService: CheckoutEventsService,
    private readonly woocommerceService: WoocommerceService,
  ) {}

  /**
   * Construit le GID Shopify complet
   */
  private buildShopifyCartGid(cartId: string): string {
    // Si c'est déjà un GID complet, le retourner tel quel
    if (cartId.startsWith('gid://shopify/Cart/')) {
      return cartId;
    }
    
    // Sinon, construire le GID à partir de l'ID court
    return `gid://shopify/Cart/${cartId}`;
  }

  /**
   * Crée un nouveau checkout à partir d'un cartId Shopify
   */
  async createCheckout(cartId: string, payDomain: string, origin: string): Promise<CreateCheckoutResponse> {
    try {
      // 1. Récupérer le store par payDomain
      const store = await this.storeService.getStoreByPayDomain(payDomain);
      if (!store) {
        throw new Error(`Store avec payDomain ${payDomain} non trouvé`);
      }

      // 2. Valider que l'origin correspond au domaine principal de la boutique
      if (origin) {
        const originHostname = new URL(origin).hostname;
        const storeDomain = store.domain;
        
        // Vérifier si l'origin correspond au domaine principal de la boutique
        if (originHostname !== storeDomain) {
          this.logger.warn(`Origin mismatch: ${originHostname} !== ${storeDomain}`);
          throw new Error(`L'origin ${originHostname} ne correspond pas au domaine principal de la boutique ${storeDomain}`);
        }
      }

      // 3. Construire le GID Shopify complet
      const shopifyCartId = this.buildShopifyCartGid(cartId);
      console.log('🛒 CartId original:', cartId);
      console.log('🛒 CartId Shopify:', shopifyCartId);

      // 4. Récupérer les données du panier Shopify
      const shopifyId = getShopifyId(store);
      if (!shopifyId) {
        throw new Error('Store is not a Shopify store');
      }

      const cartData = await this.shopifyService.getShopifyCart(shopifyCartId, shopifyId);
      if (!cartData) {
        throw new Error('Impossible de récupérer les données du panier');
      }

      // 5. Générer un ID unique pour le checkout
      const checkoutId = generateShopifyLikeId();

      // 6. Créer le checkout en base
      const checkout = await this.prisma.checkout.create({
        data: {
          id: checkoutId,
          storeId: store.id,
          cartId: shopifyCartId,
          cartData: {
            items: cartData.items.map(item => ({
              id: item.id,
              productId: item.productId,
              variantId: item.variantId,
              name: item.name,
              variantTitle: item.variantTitle,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              image: item.image,
            })),
            subtotal: cartData.subtotal,
            shippingCost: cartData.shippingCost,
            totalAmount: cartData.totalAmount,
            currency: cartData.currency,
            storeName: store.name,
            storeDomain: store.domain,
          },
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        },
      });

      console.log(`✅ Checkout créé: ${checkoutId} pour ${store.name}`);

      // Track l'initiation du checkout
      await this.checkoutEventsService.trackCheckoutInitiated(checkoutId);

      return {
        success: true,
        checkoutId: checkoutId,
      };
    } catch (error) {
      console.error('❌ Erreur lors de la création du checkout:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de la création du checkout',
      };
    }
  }

  /**
   * Récupère un checkout par son ID
   */
  async getCheckout(checkoutId: string): Promise<GetCheckoutResponse> {
    try {
      const checkout = await this.prisma.checkout.findUnique({
        where: { id: checkoutId },
        include: {
          store: {
            include: {
              payDomain: true,
            },
          },
        },
      });

      if (!checkout) {
        return {
          success: false,
          error: 'Checkout non trouvé',
        };
      }

      // Vérifier si le checkout n'a pas expiré
      if (checkout.expiresAt < new Date()) {
        // Marquer comme expiré
        await this.prisma.checkout.update({
          where: { id: checkoutId },
          data: { status: 'EXPIRED' },
        });

        return {
          success: false,
          error: 'CHECKOUT_EXPIRED',
        };
      }

      // Formater les données du store
      const store = {
        id: checkout.store.id,
        name: checkout.store.name,
        domain: checkout.store.domain,
        payDomain: checkout.store.payDomain?.hostname || checkout.store.domain,
        logoUrl: checkout.store.logoUrl,
        supportEmail: checkout.store.supportEmail,
        shopifyId: getShopifyId(checkout.store),
        requiresShipping: checkout.store.requiresShipping,
        metaPixelId: checkout.store.metaPixelId, // Facebook Pixel ID pour tracking
        tiktokPixelId: checkout.store.tiktokPixelId, // TikTok Pixel ID pour tracking
        // Address section title
        addressSectionTitle: checkout.store.addressSectionTitle,
        // Shipping display config
        shippingMethodTitle: checkout.store.shippingMethodTitle,
        shippingMethodSubtitle: checkout.store.shippingMethodSubtitle,
        shippingMinDays: checkout.store.shippingMinDays,
        shippingMaxDays: checkout.store.shippingMaxDays,
        shippingDisplayType: checkout.store.shippingDisplayType,
        shippingImageUrl: checkout.store.shippingImageUrl,
        // Trust badges
        trustBadges: checkout.store.trustBadges,
        // Trustpilot widget
        trustpilotEnabled: checkout.store.trustpilotEnabled,
        trustpilotRating: checkout.store.trustpilotRating,
        trustpilotReviewCount: checkout.store.trustpilotReviewCount,
        trustpilotUrl: checkout.store.trustpilotUrl,
        // Checkout configuration (language, theme, custom translations)
        checkoutConfig: checkout.store.checkoutConfig,
      };

      // Formater les données du cart depuis cartData
      const cartData = checkout.cartData as any;
      const cart = {
        id: checkout.cartId,
        storeId: checkout.storeId,
        storeName: cartData.storeName || checkout.store.name,
        customerEmail: cartData.customerEmail,
        items: cartData.items || [],
        subtotal: cartData.subtotal || 0,
        shippingCost: cartData.shippingCost || 0,
        totalAmount: cartData.totalAmount || 0,
        currency: cartData.currency || 'USD',
        createdAt: checkout.createdAt.toISOString(),
        updatedAt: checkout.updatedAt.toISOString(),
      };

      return {
        success: true,
        checkout: {
          id: checkout.id,
          status: checkout.status,
          expiresAt: checkout.expiresAt,
          store,
          cart,
        },
      };
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du checkout:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de la récupération du checkout',
      };
    }
  }

  /**
   * Initialise une session de checkout (WooCommerce)
   */
  async initSession(dto: {
    domain: string;
    cartToken: string;
    lineItems: Array<{
      externalProductId: string;
      externalVariantId: string;
      quantity: number;
    }>;
    returnUrl: string;
    customer?: {
      currency?: string;
      locale?: string;
    };
  }): Promise<{ success: boolean; checkoutUrl?: string; error?: string }> {
    try {
      // 1. Trouver le store par domain
      const store = await this.prisma.store.findUnique({
        where: { domain: dto.domain },
        include: { payDomain: true },
      });

      if (!store) {
        throw new Error(`Store avec domain ${dto.domain} non trouvé`);
      }

      if (store.platform !== 'WOOCOMMERCE') {
        throw new Error(`Store ${dto.domain} n'est pas un store WooCommerce`);
      }

      // 2. Récupérer les credentials WooCommerce
      const credentials = await this.woocommerceService.getStoreCredentials(store.id);
      if (!credentials) {
        throw new Error('WooCommerce credentials not found for store');
      }

      this.logger.log(`🔑 Credentials: ${credentials.domain}`);

      // 3. Construire les items du cart en fetchant chaque produit
      const items = [];
      let totalAmount = 0;

      for (const lineItem of dto.lineItems) {
        const productId = lineItem.externalProductId;
        const variationId = lineItem.externalVariantId;
        const quantity = lineItem.quantity;

        this.logger.log(`🔍 Processing lineItem: productId=${productId}, variationId=${variationId}, quantity=${quantity}`);

        // Si c'est une variation
        if (variationId && variationId !== '0' && variationId !== productId) {
          this.logger.log(`  → Detected as VARIATION`);

          const variation = await this.woocommerceService.getProductVariation(
            productId,
            variationId,
            credentials
          );

          if (variation) {
            const unitPrice = parseFloat(variation.price);
            const totalPrice = unitPrice * quantity;

            // Récupérer aussi le produit parent pour le nom et l'image
            const product = await this.woocommerceService.getProduct(productId, credentials);

            items.push({
              id: `${productId}-${variationId}`,
              productId: productId,
              variantId: variationId,
              name: product?.name || `Product ${productId}`,
              variantTitle: variation.attributes.map(a => a.option).join(', '),
              description: product?.short_description,
              quantity,
              unitPrice,
              totalPrice,
              image: product?.images[0]?.src,
            });

            this.logger.log(`  → Added variation: ${quantity}x ${product?.name} = ${totalPrice}`);
            totalAmount += totalPrice;
          }
        } else {
          // Produit simple
          this.logger.log(`  → Detected as SIMPLE PRODUCT`);
          const product = await this.woocommerceService.getProduct(productId, credentials);

          this.logger.log(`  → Product fetched: ${product ? 'YES' : 'NO'}`);
          if (product) {
            this.logger.log(`  → Product name: ${product.name}, price: ${product.price}`);
            const unitPrice = parseFloat(product.price);
            const totalPrice = unitPrice * quantity;

            items.push({
              id: productId,
              productId: productId,
              variantId: productId,
              name: product.name,
              description: product.short_description,
              quantity,
              unitPrice,
              totalPrice,
              image: product.images[0]?.src,
            });

            this.logger.log(`  → Added to cart: ${quantity}x ${product.name} = ${totalPrice} ${dto.customer?.currency || 'EUR'}`);
            totalAmount += totalPrice;
          } else {
            this.logger.warn(`  ⚠️ Product ${productId} NOT FOUND in product map!`);
          }
        }
      }

      this.logger.log(`💰 Total amount calculated: ${totalAmount} ${dto.customer?.currency || 'EUR'}`);

      // 4. Générer un ID unique pour le checkout
      const checkoutId = generateShopifyLikeId();

      // 5. Créer le checkout en base
      await this.prisma.checkout.create({
        data: {
          id: checkoutId,
          storeId: store.id,
          cartId: dto.cartToken,
          cartData: {
            items,
            subtotal: totalAmount,
            shippingCost: 0,
            totalAmount,
            currency: dto.customer?.currency || 'EUR',
            storeName: store.name,
            storeDomain: store.domain,
          },
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        },
      });

      this.logger.log(`✅ Checkout créé: ${checkoutId} pour ${store.name}`);

      // Track l'initiation du checkout
      await this.checkoutEventsService.trackCheckoutInitiated(checkoutId);

      // 6. Générer le checkoutUrl
      const checkoutDomain = store.payDomain?.hostname || store.domain;
      const checkoutUrl = `https://${checkoutDomain}/checkouts/cn/${checkoutId}`;

      this.logger.log(`📍 Generated checkout URL: ${checkoutUrl}`);

      return {
        success: true,
        checkoutUrl,
      };
    } catch (error) {
      this.logger.error('❌ Erreur lors de l\'initialisation de la session:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de l\'initialisation de la session',
      };
    }
  }

}


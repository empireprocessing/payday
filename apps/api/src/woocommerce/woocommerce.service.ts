import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

export interface WooCommerceProduct {
  id: number;
  name: string;
  price: string;
  regular_price: string;
  sale_price: string;
  description: string;
  short_description: string;
  images: Array<{ src: string }>;
  variations: number[];
}

export interface WooCommerceVariation {
  id: number;
  price: string;
  regular_price: string;
  sale_price: string;
  attributes: Array<{ name: string; option: string }>;
}

@Injectable()
export class WoocommerceService {
  private readonly logger = new Logger(WoocommerceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Génère l'URL OAuth WooCommerce
   */
  generateOAuthUrl(domain: string, storeId: string, accountId: string): string {
    const appName = 'HeyPay';
    const userId = Buffer.from(JSON.stringify({ accountId, storeId })).toString('base64');
    const returnUrl = `${process.env.DASHBOARD_URL || 'https://app.heypay.one'}/boutiques/${storeId}/integration?provider=woocommerce`;
    const callbackUrl = `${process.env.DASHBOARD_URL || 'https://app.heypay.one'}/api/woocommerce/callback`;
    const scope = 'read_write';

    this.logger.log(`🔗 OAuth URL generation:`);
    this.logger.log(`   - Dashboard URL: ${process.env.DASHBOARD_URL}`);
    this.logger.log(`   - Callback URL: ${callbackUrl}`);
    this.logger.log(`   - Return URL: ${returnUrl}`);

    // Construire l'URL OAuth
    const params = new URLSearchParams({
      app_name: appName,
      user_id: userId,
      return_url: returnUrl,
      callback_url: callbackUrl,
      scope: scope,
    });

    const oauthUrl = `https://${domain}/wc-auth/v1/authorize/?${params.toString()}`;
    this.logger.log(`   - Final OAuth URL: ${oauthUrl}`);

    return oauthUrl;
  }

  /**
   * Récupère un produit WooCommerce par ID
   */
  async getProduct(
    productId: string,
    opts: { domain: string; consumerKey: string; consumerSecret: string }
  ): Promise<WooCommerceProduct | null> {
    try {
      const auth = Buffer.from(`${opts.consumerKey}:${opts.consumerSecret}`).toString('base64');

      this.logger.log(`🌐 Fetching product ${productId} from: https://${opts.domain}/wp-json/wc/v3/products/${productId}`);
      this.logger.log(`🔐 Consumer Key: ${opts.consumerKey ? opts.consumerKey.substring(0, 15) + '...' : 'MISSING'}`);
      this.logger.log(`🔐 Consumer Secret: ${opts.consumerSecret ? opts.consumerSecret.substring(0, 15) + '...' : 'MISSING'}`);

      const response = await fetch(`https://${opts.domain}/wp-json/wc/v3/products/${productId}`, {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`WooCommerce API error: ${response.status} - ${errorText}`);
        return null;
      }

      const responseText = await response.text();
      try {
        const product = JSON.parse(responseText);
        return product;
      } catch (parseError) {
        this.logger.error(`❌ WooCommerce returned HTML instead of JSON. First 500 chars: ${responseText.substring(0, 500)}`);
        throw parseError;
      }
    } catch (error) {
      this.logger.error('Error fetching WooCommerce product:', error);
      return null;
    }
  }

  /**
   * Récupère une variation de produit WooCommerce
   */
  async getProductVariation(
    productId: string,
    variationId: string,
    opts: { domain: string; consumerKey: string; consumerSecret: string }
  ): Promise<WooCommerceVariation | null> {
    try {
      const auth = Buffer.from(`${opts.consumerKey}:${opts.consumerSecret}`).toString('base64');

      const response = await fetch(
        `https://${opts.domain}/wp-json/wc/v3/products/${productId}/variations/${variationId}`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`WooCommerce API error: ${response.status} - ${errorText}`);
        return null;
      }

      const responseText = await response.text();
      try {
        const variation = JSON.parse(responseText);
        return variation;
      } catch (parseError) {
        this.logger.error(`❌ WooCommerce variation returned HTML. First 500 chars: ${responseText.substring(0, 500)}`);
        throw parseError;
      }
    } catch (error) {
      this.logger.error('Error fetching WooCommerce variation:', error);
      return null;
    }
  }

  /**
   * Crée une commande WooCommerce
   */
  async createOrder(
    orderData: any,
    opts: { domain: string; consumerKey: string; consumerSecret: string }
  ): Promise<any> {
    try {
      const auth = Buffer.from(`${opts.consumerKey}:${opts.consumerSecret}`).toString('base64');

      const response = await fetch(`https://${opts.domain}/wp-json/wc/v3/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error(`WooCommerce order create failed: ${response.status} ${errorData}`);
        throw new Error(`WooCommerce order creation failed: ${response.status}`);
      }

      const responseText = await response.text();
      try {
        const order = JSON.parse(responseText);
        this.logger.log(`✅ WooCommerce order created: ${order.id}`);
        return order;
      } catch (parseError) {
        this.logger.error(`❌ WooCommerce order creation returned HTML. First 500 chars: ${responseText.substring(0, 500)}`);
        throw parseError;
      }
    } catch (error) {
      this.logger.error('Error creating WooCommerce order:', error);
      throw error;
    }
  }

  /**
   * Récupère tous les produits (utilisé pour test/debug)
   */
  async getAllProducts(
    opts: { domain: string; consumerKey: string; consumerSecret: string }
  ): Promise<WooCommerceProduct[]> {
    try {
      const auth = Buffer.from(`${opts.consumerKey}:${opts.consumerSecret}`).toString('base64');

      this.logger.log(`🌐 Fetching products from: https://${opts.domain}/wp-json/wc/v3/products`);
      this.logger.log(`🔐 Using auth: ${opts.consumerKey.substring(0, 15)}...`);

      const response = await fetch(
        `https://${opts.domain}/wp-json/wc/v3/products?per_page=100`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
          },
          signal: AbortSignal.timeout(15000), // 15s timeout
        }
      );

      this.logger.log(`📡 Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`WooCommerce API error: ${response.status} - ${errorText}`);
        return [];
      }

      const responseText = await response.text();
      try {
        const products = JSON.parse(responseText);
        this.logger.log(`✅ Successfully fetched ${products.length} products`);
        return products;
      } catch (parseError) {
        this.logger.error(`❌ WooCommerce products returned HTML. First 500 chars: ${responseText.substring(0, 500)}`);
        return [];
      }
    } catch (error) {
      this.logger.error('❌ Error fetching WooCommerce products:', error);
      this.logger.error(`Error details: ${error.message}`);
      if (error.cause) {
        this.logger.error(`Cause: ${error.cause}`);
      }
      return [];
    }
  }

  /**
   * Récupère plusieurs produits en batch via l'API REST v3
   */
  async getProductsBatch(
    productIds: string[],
    opts: { domain: string; consumerKey: string; consumerSecret: string }
  ): Promise<WooCommerceProduct[]> {
    try {
      const auth = Buffer.from(`${opts.consumerKey}:${opts.consumerSecret}`).toString('base64');
      const ids = productIds.join(',');

      const response = await fetch(
        `https://${opts.domain}/wp-json/wc/v3/products?include=${ids}&per_page=100`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`WooCommerce API error: ${response.status} - ${errorText}`);
        return [];
      }

      const responseText = await response.text();
      try {
        const products = JSON.parse(responseText);
        return products;
      } catch (parseError) {
        this.logger.error(`❌ WooCommerce batch returned HTML. First 500 chars: ${responseText.substring(0, 500)}`);
        return [];
      }
    } catch (error) {
      this.logger.error('Error fetching WooCommerce products batch:', error);
      return [];
    }
  }

  /**
   * Récupère les credentials WooCommerce depuis le store
   */
  async getStoreCredentials(storeId: string): Promise<{
    domain: string;
    consumerKey: string;
    consumerSecret: string;
  } | null> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store || store.platform !== 'WOOCOMMERCE' || !store.platformConfig) {
      return null;
    }

    const config = store.platformConfig as any;
    return {
      domain: config.domain || store.domain,
      consumerKey: config.consumerKey,
      consumerSecret: config.consumerSecret,
    };
  }
}

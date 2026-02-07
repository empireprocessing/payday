import { Controller, Get, Post, Param, Query, Body, BadRequestException, Logger } from '@nestjs/common'
import { ShopifyService } from './shopify.service'
import { PrismaService } from '../common/prisma.service'
import * as crypto from 'crypto'

@Controller('shopify')
export class ShopifyController {
  private readonly logger = new Logger(ShopifyController.name);

  constructor(
    private readonly shopifyService: ShopifyService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('cart/:cartId')
  async getCart(
    @Param('cartId') cartId: string,
    @Query('storeId') storeId: string
  ) {
    try {
      const cart = await this.shopifyService.getShopifyCart(cartId, storeId)

      if (!cart) {
        return {
          success: false,
          error: 'Cart not found'
        }
      }

      return {
        success: true,
        cart
      }
    } catch (error) {
      console.error('Error fetching Shopify cart:', error)
      return {
        success: false,
        error: 'Failed to fetch cart'
      }
    }
  }

  /**
   * Generate Shopify OAuth authorization URL
   */
  @Post('oauth/generate')
  async generateOAuthUrl(
    @Body() body: { storeId: string },
  ) {
    const { storeId } = body;

    if (!storeId) {
      throw new BadRequestException('storeId is required');
    }

    // Get store and its platformConfig (contains clientId, clientSecret, shopifyId)
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new BadRequestException('Store not found');
    }

    const config = store.platformConfig as any;
    if (!config?.shopifyId || !config?.clientId) {
      throw new BadRequestException('Store is missing Shopify configuration (shopifyId, clientId)');
    }

    const dashboardUrl = process.env.DASHBOARD_URL;
    if (!dashboardUrl) {
      throw new BadRequestException('DASHBOARD_URL is not configured');
    }

    // Generate a random state/nonce for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');
    const stateParam = `${state}:${storeId}`;

    const scopes = [
      'write_orders',
      'read_orders',
      'write_customers',
      'read_customers',
      'write_products',
      'read_products',
      'write_themes',
      'read_themes',
    ].join(',');

    const redirectUri = `${dashboardUrl}/api/shopify/callback`;
    const shop = `${config.shopifyId}.myshopify.com`;

    const oauthUrl = `https://${shop}/admin/oauth/authorize?` +
      `client_id=${encodeURIComponent(config.clientId)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(stateParam)}`;

    this.logger.log(`Generated Shopify OAuth URL for store ${storeId}, shop ${shop}`);

    return {
      success: true,
      oauthUrl,
    };
  }

  /**
   * Exchange Shopify authorization code for access token
   */
  @Post('oauth/callback')
  async handleOAuthCallback(
    @Body() body: { code: string; shop: string; state: string; hmac?: string },
  ) {
    const { code, shop, state, hmac } = body;

    if (!code || !shop || !state) {
      throw new BadRequestException('code, shop, and state are required');
    }

    // Validate shop hostname
    const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;
    if (!shopRegex.test(shop)) {
      throw new BadRequestException('Invalid shop hostname');
    }

    // Extract storeId from state (format: nonce:storeId)
    const stateParts = state.split(':');
    if (stateParts.length < 2) {
      throw new BadRequestException('Invalid state parameter');
    }
    const storeId = stateParts.slice(1).join(':');

    // Get the store and its credentials
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new BadRequestException('Store not found');
    }

    const config = store.platformConfig as any;
    const clientId = config?.clientId;
    const clientSecret = config?.clientSecret;

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Store is missing Shopify OAuth credentials');
    }

    // Exchange code for access token
    try {
      const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        this.logger.error(`Shopify token exchange failed: ${errorText}`);
        throw new BadRequestException('Failed to exchange authorization code');
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      const grantedScopes = tokenData.scope;

      if (!accessToken) {
        throw new BadRequestException('No access token received from Shopify');
      }

      // Update the store with the access token (preserve existing config)
      const updatedStore = await this.prisma.store.update({
        where: { id: storeId },
        data: {
          platformConfig: {
            ...config,
            accessToken,
          },
        },
        include: {
          payDomain: true,
        },
      });

      this.logger.log(`Shopify OAuth completed for store ${storeId}, scopes: ${grantedScopes}`);

      return {
        success: true,
        store: updatedStore,
        scopes: grantedScopes,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Shopify OAuth callback error:', error);
      throw new BadRequestException('Failed to complete Shopify OAuth');
    }
  }

  /**
   * Check Shopify connection status for a store
   */
  @Get('oauth/status/:storeId')
  async getOAuthStatus(@Param('storeId') storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { platformConfig: true, platform: true },
    });

    if (!store) {
      throw new BadRequestException('Store not found');
    }

    const config = store.platformConfig as any;
    const isConnected = store.platform === 'SHOPIFY' && !!config?.accessToken;

    return {
      connected: isConnected,
      shopifyId: config?.shopifyId || null,
    };
  }
}

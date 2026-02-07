import { Controller, Get, Post, Put, Delete, Body, Param, ValidationPipe, HttpException, HttpStatus } from '@nestjs/common';
import { StoreService } from './store.service';
import { PayDomainService } from '../pay-domain/pay-domain.service';
import { StorePlatform, PlatformConfig } from './interfaces/platform-config.interface';

@Controller('store')
export class StoreController {
  constructor(
    private readonly storeService: StoreService,
    private readonly payDomainService: PayDomainService,
  ) {}

  /**
   * Récupérer toutes les boutiques
   */
  @Get()
  async getAllStores() {
    return this.storeService.getAllStores();
  }

  /**
   * Récupérer une boutique par ID
   */
  @Get(':id')
  async getStoreById(@Param('id') id: string) {
    return this.storeService.getStoreById(id);
  }

  /**
   * Créer une nouvelle boutique
   */
  @Post()
  async createStore(@Body(ValidationPipe) storeData: {
    name: string;
    domain: string;
    platform: StorePlatform;
    platformConfig?: PlatformConfig;
    payDomain?: string;
    logoUrl?: string;
    runner?: string | null;
    checkoutConfig?: any;
  }) {
    // Créer le store (sans payDomain - il sera créé après via PayDomainService)
    const store = await this.storeService.createStore({
      name: storeData.name,
      domain: storeData.domain,
      platform: storeData.platform,
      platformConfig: storeData.platformConfig,
      logoUrl: storeData.logoUrl,
      runner: storeData.runner || null,
      checkoutConfig: storeData.checkoutConfig,
      // payDomain n'est PAS passé ici - il sera créé via PayDomainService.createPayDomain()
      // pour déclencher l'ajout automatique à Vercel/Cloudflare
    });

    // Créer le PayDomain si fourni (via PayDomainService pour déclencher l'ajout à Vercel/Cloudflare)
    if (storeData.payDomain) {
      await this.payDomainService.createPayDomain(store.id, {
        hostname: storeData.payDomain,
      });
    }

    // Retourner le store avec le payDomain inclus
    return this.storeService.getStoreById(store.id);
  }

  /**
   * Mettre à jour une boutique
   */
  @Put(':id')
  async updateStore(
    @Param('id') id: string,
    @Body(ValidationPipe) updateData: {
      name?: string;
      domain?: string;
      platform?: StorePlatform;
      platformConfig?: PlatformConfig;
      logoUrl?: string;
      payDomain?: string;
      supportEmail?: string | null;
      runner?: string | null;
      requiresShipping?: boolean;
      shippingMethodTitle?: string | null;
      shippingMethodSubtitle?: string | null;
      shippingMinDays?: number;
      shippingMaxDays?: number;
      trustBadges?: Array<{ icon: string; title: string; subtitle: string }> | null;
      checkoutConfig?: any;
    }
  ) {
    try {
      return await this.storeService.updateStore(id, updateData);
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de la mise à jour de la boutique',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Supprimer une boutique
   */
  @Delete(':id')
  async deleteStore(@Param('id') id: string) {
    return this.storeService.deleteStore(id);
  }

  /**
   * Récupérer le domaine d'une boutique depuis son payDomain
   */
  @Get('domain/:payDomain')
  async getStoreDomainByPayDomain(@Param('payDomain') payDomain: string) {
    const store = await this.storeService.getStoreByPayDomain(payDomain);
    if (!store) {
      return { success: false, error: 'Store not found' };
    }
    return {
      success: true,
      domain: store.domain,
      storeId: store.id
    };
  }

  /**
   * Mettre à jour les paramètres Meta Conversion API
   */
  @Put(':id/meta-settings')
  async updateMetaSettings(
    @Param('id') id: string,
    @Body(ValidationPipe) metaSettings: {
      metaPixelId?: string;
      metaAccessToken?: string;
      metaNewCustomersOnly?: boolean;
    }
  ) {
    return this.storeService.updateMetaSettings(id, metaSettings);
  }

  /**
   * Récupérer les paramètres Meta (déchiffrés)
   */
  @Get(':id/meta-settings')
  async getMetaSettings(@Param('id') id: string) {
    return this.storeService.getMetaSettings(id);
  }

  /**
   * Mettre à jour les paramètres TikTok Pixel
   */
  @Put(':id/tiktok-settings')
  async updateTiktokSettings(
    @Param('id') id: string,
    @Body(ValidationPipe) tiktokSettings: {
      tiktokPixelId?: string | null;
    }
  ) {
    return this.storeService.updateTiktokSettings(id, tiktokSettings);
  }

  /**
   * Récupérer les paramètres TikTok Pixel
   */
  @Get(':id/tiktok-settings')
  async getTiktokSettings(@Param('id') id: string) {
    return this.storeService.getTiktokSettings(id);
  }
}

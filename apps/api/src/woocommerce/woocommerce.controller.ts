import { Controller, Post, Get, Body, Query, Res, Logger, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { WoocommerceService } from './woocommerce.service';
import { PrismaService } from '../common/prisma.service';

@Controller('woocommerce')
export class WoocommerceController {
  private readonly logger = new Logger(WoocommerceController.name);

  constructor(
    private readonly woocommerceService: WoocommerceService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Génère l'URL OAuth WooCommerce
   * Appelé depuis le dashboard
   */
  @Post('oauth/generate')
  async generateOAuthUrl(
    @Body() body: { domain: string; storeId: string; accountId: string },
  ) {
    const { domain, storeId, accountId } = body;

    if (!domain || !storeId || !accountId) {
      throw new BadRequestException('domain, storeId and accountId are required');
    }

    const oauthUrl = this.woocommerceService.generateOAuthUrl(domain, storeId, accountId);

    return {
      success: true,
      oauthUrl,
    };
  }

  // Note: Le callback OAuth est maintenant géré par le dashboard
  // Voir: apps/dashboard/app/api/woocommerce/callback/route.ts
}

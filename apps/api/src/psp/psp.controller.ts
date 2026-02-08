import { Controller, Get, Post, Put, Delete, Body, Param, ValidationPipe, Query, BadRequestException } from '@nestjs/common';
import { PspService } from './psp.service';

@Controller('psp')
export class PspController {
  constructor(private readonly pspService: PspService) {}

  /**
   * Récupérer tous les PSP
   */
  @Get()
  async getAllPSPs() {
    return this.pspService.getAllPSPs();
  }

  /**
   * Sélectionner le meilleur PSP pour un paiement (pour WooCommerce/external)
   * GET /psp/select?payDomain=pay.example.com&amount=50.00&currency=EUR
   */
  @Get('select')
  async selectPSP(
    @Query('payDomain') payDomain: string,
    @Query('amount') amount: string,
    @Query('currency') currency?: string,
  ) {
    return this.pspService.selectPSPForPayment(payDomain, parseFloat(amount), currency);
  }

  /**
   * Récupérer un PSP par ID
   */
  @Get(':id')
  async getPSPById(@Param('id') id: string) {
    return this.pspService.getPSPById(id);
  }

  /**
   * Récupérer les PSP d'une boutique
   */
  @Get('store/:storeId')
  async getPSPsByStore(@Param('storeId') storeId: string) {
    return this.pspService.getPSPsByStore(storeId);
  }

  /**
   * Créer un nouveau PSP global
   */
  @Post()
  async createPSP(@Body(ValidationPipe) pspData: {
    name: string;
    pspType: string;
    publicKey: string;
    secretKey: string;
    monthlyCapacityEur?: number;
    dailyCapacityEur?: number;
    config?: any;
  }) {
    return this.pspService.createPSP(pspData);
  }

  /**
   * Échanger le code OAuth contre le stripe_user_id
   * POST /psp/stripe-connect/oauth-callback
   * (Placé avant les routes :id pour éviter les conflits)
   */
  @Post('stripe-connect/oauth-callback')
  async handleOAuthCallback(
    @Body() body: { code: string; state: string }
  ) {
    try {
      return await this.pspService.handleOAuthCallback(body.code, body.state);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Lier un PSP à une boutique
   */
  @Post('link')
  async linkPSPToStore(@Body(ValidationPipe) linkData: {
    storeId: string;
    pspId: string;
  }) {
    return this.pspService.createStorePSP(linkData);
  }

  /**
   * Mettre à jour un PSP
   */
  @Put(':id')
  async updatePSP(
    @Param('id') id: string,
    @Body(ValidationPipe) updateData: {
      name?: string;
      monthlyCapacityEur?: number;
      dailyCapacityEur?: number;
      isActive?: boolean;
      selfieVerified?: boolean;
    }
  ) {
    return this.pspService.updatePSP(id, updateData);
  }

  /**
   * Mettre à jour les credentials d'un PSP
   */
  @Put(':id/credentials')
  async updatePSPCredentials(
    @Param('id') id: string,
    @Body(ValidationPipe) credentials: {
      publicKey?: string;
      secretKey?: string;
    }
  ) {
    return this.pspService.updatePSPCredentials(id, credentials);
  }

  /**
   * Soft delete un PSP (archiver)
   */
  @Delete(':id')
  async deletePSP(@Param('id') id: string) {
    return this.pspService.softDeletePSP(id);
  }

  /**
   * Hard delete un PSP (suppression définitive)
   */
  @Delete(':id/hard')
  async hardDeletePSP(
    @Param('id') id: string,
    @Query('force') force?: string
  ) {
    try {
      const forceDelete = force === 'true';
      return await this.pspService.hardDeletePSP(id, forceDelete);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Récupérer le nombre de paiements liés à un PSP
   */
  @Get(':id/payment-count')
  async getPaymentCount(@Param('id') id: string) {
    const count = await this.pspService.getPaymentCount(id);
    return { count };
  }

  /**
   * Restaurer un PSP archivé
   */
  @Post(':id/restore')
  async restorePSP(@Param('id') id: string) {
    return this.pspService.restorePSP(id);
  }

  // ── Stripe Connect OAuth ─────────────────────────────────────

  /**
   * Générer l'URL OAuth Standard pour connecter un compte Stripe existant
   * POST /psp/:id/stripe-connect/create
   */
  @Post(':id/stripe-connect/create')
  async createStripeConnect(
    @Param('id') id: string,
    @Body() body: { redirectUri: string }
  ) {
    try {
      return await this.pspService.generateOAuthUrl(id, body.redirectUri);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Vérifier le statut Connect d'un PSP
   * GET /psp/:id/stripe-connect/status
   */
  @Get(':id/stripe-connect/status')
  async getStripeConnectStatus(@Param('id') id: string) {
    try {
      return await this.pspService.checkStripeConnectStatus(id);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}

import { Controller, Post, Get, Body, Param, ValidationPipe, HttpException, HttpStatus } from '@nestjs/common';
import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';
import { CheckoutService } from './checkout.service';

export class CreateCheckoutDto {
  @IsString()
  @IsNotEmpty()
  cartId: string;

  @IsString()
  @IsNotEmpty()
  payDomain: string;

  @IsString()
  @IsNotEmpty()
  origin: string;
}

export class SessionInitDto {
  @IsString()
  @IsNotEmpty()
  domain: string;

  @IsString()
  @IsNotEmpty()
  cartToken: string;

  @IsArray()
  lineItems: Array<{
    externalProductId: string;
    externalVariantId: string;
    quantity: number;
  }>;

  @IsString()
  @IsNotEmpty()
  returnUrl: string;

  @IsOptional()
  customer?: {
    currency?: string;
    locale?: string;
  };
}

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  /**
   * Crée un nouveau checkout à partir d'un cartId Shopify
   * POST /checkout/create
   */
  @Post('create')
  async createCheckout(
    @Body(ValidationPipe) createCheckoutDto: CreateCheckoutDto
  ) {
    console.log('🛒 CartId:', createCheckoutDto.cartId);
    console.log('🌐 PayDomain:', createCheckoutDto.payDomain);
    console.log('🔗 Origin:', createCheckoutDto.origin);
    
    return await this.checkoutService.createCheckout(
      createCheckoutDto.cartId, 
      createCheckoutDto.payDomain,
      createCheckoutDto.origin
    );
  }

  /**
   * Récupère un checkout par son ID
   * GET /checkout/:checkoutId
   */
  @Get(':checkoutId')
  async getCheckout(@Param('checkoutId') checkoutId: string) {
    const result = await this.checkoutService.getCheckout(checkoutId);

    if (!result.success) {
      // Retourner des codes de statut HTTP appropriés selon le type d'erreur
      if (result.error === 'CHECKOUT_EXPIRED') {
        throw new HttpException(
          { success: false, error: 'CHECKOUT_EXPIRED' },
          HttpStatus.GONE // 410 Gone - La ressource n'existe plus
        );
      } else if (result.error === 'Checkout non trouvé') {
        throw new HttpException(
          { success: false, error: 'Checkout non trouvé' },
          HttpStatus.NOT_FOUND // 404 Not Found
        );
      } else {
        throw new HttpException(
          { success: false, error: result.error },
          HttpStatus.INTERNAL_SERVER_ERROR // 500 Internal Server Error
        );
      }
    }

    return result;
  }

  /**
   * Initialise une session de checkout (WooCommerce / externe)
   * POST /checkout/session/init
   */
  @Post('session/init')
  async initSession(@Body(ValidationPipe) dto: SessionInitDto) {
    console.log('🛒 Session init for domain:', dto.domain);
    console.log('📦 Line items:', dto.lineItems.length);

    return await this.checkoutService.initSession(dto);
  }
}


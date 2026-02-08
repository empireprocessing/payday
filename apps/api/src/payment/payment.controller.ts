import { Controller, Post, Body, ValidationPipe, Headers, Get, Param, Query } from '@nestjs/common'
import { PaymentService } from './payment.service'
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto'
import { ConfirmPaymentDto } from './dto/confirm-payment.dto'
import { CreatePaymentFromCartDto } from './dto/create-payment-from-cart.dto'
import { RetryPaymentDto } from './dto/retry-payment.dto'

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  async getAllPayments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('storeId') storeId?: string,
    @Query('storeIds') storeIds?: string,
    @Query('pspId') pspId?: string,
  ) {
    const storeIdsArray = storeIds ? storeIds.split(',').filter(id => id.trim()) : undefined;
    return this.paymentService.getAllPayments({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      storeId,
      storeIds: storeIdsArray,
      pspId,
    })
  }

  @Post('create-intent')
  async createPaymentIntent(@Body(ValidationPipe) createPaymentIntentDto: CreatePaymentIntentDto) {
    return await this.paymentService.createPaymentIntent(createPaymentIntentDto)
  }

  @Post('from-cart')
  async createPaymentFromCart(
    @Body(ValidationPipe) createPaymentFromCartDto: CreatePaymentFromCartDto,
    @Headers('referer') referer?: string
  ) {
    console.log('🔍 Referer:', referer)
    return await this.paymentService.createPaymentFromCart(createPaymentFromCartDto.cartId, referer)
  }

  @Post('from-checkout')
  async createPaymentFromCheckout(
    @Body(ValidationPipe) createPaymentFromCheckoutDto: {
      checkoutId: string;
      customerData?: {
        email?: string;
        name?: string;
        phone?: string;
        address?: {
          line1?: string;
          line2?: string;
          city?: string;
          postal_code?: string;
          country?: string;
          state?: string;
        };
      };
      isExpressCheckout?: boolean;
    },
    @Headers('referer') referer?: string
  ) {
    return await this.paymentService.createPaymentFromCheckout(
      createPaymentFromCheckoutDto.checkoutId,
      referer,
      createPaymentFromCheckoutDto.customerData,
      createPaymentFromCheckoutDto.isExpressCheckout
    )
  }

  @Get('checkout/:checkoutId/publishable-key')
  async getPublishableKeyForCheckout(@Param('checkoutId') checkoutId: string) {
    return await this.paymentService.getPublishableKeyForCheckout(checkoutId)
  }

  @Get('checkout/:checkoutId/payment-intent')
  async getOrCreatePaymentIntent(@Param('checkoutId') checkoutId: string) {
    return await this.paymentService.getOrCreatePaymentIntent(checkoutId)
  }

  @Get('checkout-info')
  async getCheckoutInfo(
    @Query('cartId') cartId: string,
    @Query('domain') domain?: string,
    @Headers('referer') referer?: string
  ) {
    console.log('🔍 Referer:', referer)
    console.log('🌐 Domain query param:', domain)
    return await this.paymentService.getCheckoutInfo(cartId, domain, referer)
  }

  @Post('confirm')
  async confirmPayment(@Body(ValidationPipe) confirmPaymentDto: ConfirmPaymentDto) {
    console.log('🔍 DTO reçu:', JSON.stringify(confirmPaymentDto, null, 2))
    
    const customerData = confirmPaymentDto.customerEmail ? {
      email: confirmPaymentDto.customerEmail,
      name: confirmPaymentDto.customerName,
      phone: confirmPaymentDto.customerPhone,
      address: confirmPaymentDto.customerAddress,
    } : undefined

    console.log('🧑‍💼 Customer data préparé:', JSON.stringify(customerData, null, 2))

    return await this.paymentService.confirmPayment(
      confirmPaymentDto.paymentIntentId, 
      customerData
    )
  }

  @Get('order/:paymentIntentId')
  async getOrderByPaymentIntent(@Param('paymentIntentId') paymentIntentId: string) {
    return await this.paymentService.getOrderByPaymentIntent(paymentIntentId)
  }

  @Post('retry')
  async retryPayment(@Body(ValidationPipe) retryDto: RetryPaymentDto) {
    return await this.paymentService.retryPayment(retryDto)
  }

  /**
   * Créer un paiement via Basis Theory + Stripe Connect
   * POST /payment/from-checkout-bt
   */
  @Post('from-checkout-bt')
  async createPaymentFromCheckoutBT(
    @Body() body: {
      checkoutId: string;
      tokenIntentId: string;
      customerData?: {
        email?: string;
        name?: string;
        phone?: string;
        address?: {
          line1?: string;
          line2?: string;
          city?: string;
          postal_code?: string;
          country?: string;
          state?: string;
        };
      };
    }
  ) {
    return await this.paymentService.createPaymentFromCheckoutBT(
      body.checkoutId,
      body.tokenIntentId,
      body.customerData
    )
  }

  /**
   * Confirmer un paiement BT après 3DS
   * POST /payment/confirm-bt
   */
  @Post('confirm-bt')
  async confirmPaymentBT(
    @Body() body: {
      paymentIntentId: string;
      customerData?: {
        email?: string;
        name?: string;
        phone?: string;
        address?: {
          line1?: string;
          line2?: string;
          city?: string;
          postal_code?: string;
          country?: string;
          state?: string;
        };
      };
    }
  ) {
    return await this.paymentService.confirmPaymentBT(
      body.paymentIntentId,
      body.customerData
    )
  }

  /**
   * Préparer le paiement WooCommerce - Sélectionne le meilleur PSP disponible
   * POST /payment/woocommerce/prepare
   */
  @Post('woocommerce/prepare')
  async prepareWooCommercePayment(
    @Body(ValidationPipe) body: {
      domain: string;
    }
  ) {
    return await this.paymentService.prepareWooCommercePayment(body.domain);
  }

  /**
   * Créer un PaymentIntent pour WooCommerce
   * POST /payment/woocommerce/intent
   */
  @Post('woocommerce/intent')
  async createWooCommercePaymentIntent(
    @Body(ValidationPipe) body: {
      domain: string;
      amount: number;
      currency: string;
      orderId: string;
      customerEmail?: string;
      paymentMethod: string; // Stripe PaymentMethod ID from client (required)
      id: string; // ID from prepare endpoint (required)
    }
  ) {
    return await this.paymentService.createWooCommercePaymentIntent(
      body.domain,
      body.amount,
      body.currency,
      body.orderId,
      body.customerEmail,
      body.paymentMethod,
      body.id
    );
  }
}

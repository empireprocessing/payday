import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { CheckoutEventsService } from './checkout-events.service';
import { CheckoutStep } from '@prisma/client';

export interface TrackEventDto {
  checkoutId: string;
  step: CheckoutStep;
  metadata?: Record<string, any>;
}


@Controller('checkout-events')
export class CheckoutEventsController {
  constructor(private readonly checkoutEventsService: CheckoutEventsService) {}

  /**
   * Track un événement générique
   */
  @Post('track')
  async trackEvent(@Body() data: TrackEventDto) {
    await this.checkoutEventsService.trackEvent(data);
    return { success: true };
  }

  /**
   * Track l'initiation d'un checkout
   */
  @Post('checkout-initiated')
  async trackCheckoutInitiated(@Body() data: { checkoutId: string }) {
    await this.checkoutEventsService.trackCheckoutInitiated(data.checkoutId);
    return { success: true };
  }

  /**
   * Track le progrès de remplissage des infos personnelles
   */
  @Post('customer-info-progress')
  async trackCustomerInfoProgress(
    @Body() data: { checkoutId: string; metadata?: Record<string, any> }
  ) {
    await this.checkoutEventsService.trackCustomerInfoProgress(
      data.checkoutId,
      data.metadata
    );
    return { success: true };
  }

  /**
   * Track quand l'utilisateur a rempli ses infos personnelles
   */
  @Post('customer-info-entered')
  async trackCustomerInfoEntered(
    @Body() data: { checkoutId: string; metadata?: Record<string, any> }
  ) {
    await this.checkoutEventsService.trackCustomerInfoEntered(
      data.checkoutId,
      data.metadata
    );
    return { success: true };
  }

  /**
   * Track quand l'utilisateur a commencé à taper dans les champs de paiement
   */
  @Post('payment-info-started')
  async trackPaymentInfoStarted(
    @Body() data: { checkoutId: string; metadata?: Record<string, any> }
  ) {
    await this.checkoutEventsService.trackPaymentInfoStarted(
      data.checkoutId,
      data.metadata
    );
    return { success: true };
  }

  /**
   * Track quand l'utilisateur a complété tous les champs de paiement
   */
  @Post('payment-info-completed')
  async trackPaymentInfoCompleted(
    @Body() data: { checkoutId: string; metadata?: Record<string, any> }
  ) {
    await this.checkoutEventsService.trackPaymentInfoCompleted(
      data.checkoutId,
      data.metadata
    );
    return { success: true };
  }

  /**
   * Track quand l'utilisateur a cliqué sur le bouton payer
   */
  @Post('pay-button-clicked')
  async trackPayButtonClicked(
    @Body() data: { checkoutId: string; metadata?: Record<string, any> }
  ) {
    await this.checkoutEventsService.trackPayButtonClicked(
      data.checkoutId,
      data.metadata
    );
    return { success: true };
  }

  /**
   * Track une tentative de paiement
   */
  @Post('payment-attempted')
  async trackPaymentAttempted(
    @Body() data: { checkoutId: string; metadata?: Record<string, any> }
  ) {
    await this.checkoutEventsService.trackPaymentAttempted(
      data.checkoutId,
      data.metadata
    );
    return { success: true };
  }

  /**
   * Track un paiement réussi
   */
  @Post('payment-successful')
  async trackPaymentSuccessful(
    @Body() data: { checkoutId: string; metadata?: Record<string, any> }
  ) {
    await this.checkoutEventsService.trackPaymentSuccessful(
      data.checkoutId,
      data.metadata
    );
    return { success: true };
  }

  /**
   * Track un paiement échoué
   */
  @Post('payment-failed')
  async trackPaymentFailed(
    @Body() data: { checkoutId: string; metadata?: Record<string, any> }
  ) {
    await this.checkoutEventsService.trackPaymentFailed(
      data.checkoutId,
      data.metadata
    );
    return { success: true };
  }

  /**
   * Récupère tous les événements d'un checkout
   */
  @Get(':checkoutId')
  async getCheckoutEvents(@Param('checkoutId') checkoutId: string) {
    return this.checkoutEventsService.getCheckoutEvents(checkoutId);
  }
}

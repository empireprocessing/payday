import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CheckoutStep } from '@prisma/client';

export interface CheckoutEventData {
  checkoutId: string;
  step: CheckoutStep;
  metadata?: Record<string, any>;
}

@Injectable()
export class CheckoutEventsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Enregistre un événement de checkout
   * Pour customer-info-started, met à jour l'événement existant s'il existe
   */
  async trackEvent(data: CheckoutEventData): Promise<void> {
    const { checkoutId, step, metadata } = data;

    // Vérifier si l'événement existe déjà
    const existingEvent = await this.prisma.checkoutEvent.findFirst({
      where: {
        checkoutId,
        step,
      },
    });

    if (existingEvent) {
      // Pour customer-info-progress, mettre à jour l'événement existant
      if (step === 'CUSTOMER_INFO_PROGRESS') {
        await this.prisma.checkoutEvent.update({
          where: { id: existingEvent.id },
          data: {
            metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
          },
        });
      }
      // Pour les autres événements, ne rien faire (éviter les doublons)
      return;
    }

    // Créer l'événement
    await this.prisma.checkoutEvent.create({
      data: {
        checkoutId,
        step,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      },
    });
  }

  /**
   * Track l'initiation d'un checkout
   */
  async trackCheckoutInitiated(checkoutId: string): Promise<void> {
    await this.trackEvent({
      checkoutId,
      step: CheckoutStep.CHECKOUT_INITIATED,
    });
  }

  /**
   * Track le progrès de remplissage des infos personnelles
   */
  async trackCustomerInfoProgress(checkoutId: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      checkoutId,
      step: CheckoutStep.CUSTOMER_INFO_PROGRESS,
      metadata,
    });
  }

  /**
   * Track quand l'utilisateur a rempli ses infos personnelles
   */
  async trackCustomerInfoEntered(checkoutId: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      checkoutId,
      step: CheckoutStep.CUSTOMER_INFO_ENTERED,
      metadata,
    });
  }

  /**
   * Track quand l'utilisateur a commencé à taper dans les champs de paiement
   */
  async trackPaymentInfoStarted(checkoutId: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      checkoutId,
      step: CheckoutStep.PAYMENT_INFO_STARTED,
      metadata,
    });
  }

  /**
   * Track quand l'utilisateur a complété tous les champs de paiement obligatoires
   */
  async trackPaymentInfoCompleted(checkoutId: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      checkoutId,
      step: CheckoutStep.PAYMENT_INFO_COMPLETED,
      metadata,
    });
  }

  /**
   * Track quand l'utilisateur a cliqué sur le bouton payer
   */
  async trackPayButtonClicked(checkoutId: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      checkoutId,
      step: CheckoutStep.PAY_BUTTON_CLICKED,
      metadata,
    });
  }

  /**
   * Track une tentative de paiement
   */
  async trackPaymentAttempted(checkoutId: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      checkoutId,
      step: CheckoutStep.PAYMENT_ATTEMPTED,
      metadata,
    });
  }

  /**
   * Track un paiement réussi
   */
  async trackPaymentSuccessful(checkoutId: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      checkoutId,
      step: CheckoutStep.PAYMENT_SUCCESSFUL,
      metadata,
    });
  }

  /**
   * Track un paiement échoué
   */
  async trackPaymentFailed(checkoutId: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      checkoutId,
      step: CheckoutStep.PAYMENT_FAILED,
      metadata,
    });
  }

  /**
   * Récupère tous les événements d'un checkout
   */
  async getCheckoutEvents(checkoutId: string) {
    return this.prisma.checkoutEvent.findMany({
      where: { checkoutId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Vérifie si un événement spécifique existe pour un checkout
   */
  async hasEvent(checkoutId: string, step: CheckoutStep): Promise<boolean> {
    const event = await this.prisma.checkoutEvent.findFirst({
      where: {
        checkoutId,
        step,
      },
    });
    return !!event;
  }
}

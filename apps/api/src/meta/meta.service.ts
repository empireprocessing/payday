import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Service pour envoyer des événements à Meta Conversion API
 * Documentation: https://developers.facebook.com/docs/marketing-api/conversions-api
 */
@Injectable()
export class MetaService {
  private readonly logger = new Logger(MetaService.name);
  private readonly META_API_VERSION = 'v21.0';
  private readonly META_API_BASE_URL = 'https://graph.facebook.com';

  /**
   * Envoie un événement à Meta Conversion API (générique)
   */
  private async sendEvent(
    eventName: string,
    pixelId: string,
    accessToken: string,
    eventData: any
  ): Promise<{ success: boolean; error?: string }> {
    const url = `${this.META_API_BASE_URL}/${this.META_API_VERSION}/${pixelId}/events`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [eventData],
          access_token: accessToken,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.error?.message || 'Unknown error';
        this.logger.warn(`❌ Meta ${eventName} failed (Pixel ${pixelId}): ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      this.logger.log(`✅ Meta ${eventName} sent (Pixel ${pixelId})`);
      return { success: true };
    } catch (error) {
      this.logger.warn(`❌ Meta ${eventName} failed (Pixel ${pixelId}): ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envoie un événement InitiateCheckout à Meta
   */
  async sendInitiateCheckoutEvent(params: {
    pixelId: string;
    accessToken: string;
    eventData: {
      eventTime: number;
      eventId?: string;
      email?: string;
      phone?: string;
      firstName?: string;
      lastName?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
      currency: string;
      value: number;
      contentIds?: string[];
      contents?: Array<{ id: string; quantity: number; item_price: number }>;
    };
  }): Promise<{ success: boolean; error?: string }> {
    const { pixelId, accessToken, eventData } = params;
    const eventId = eventData.eventId || crypto.randomBytes(16).toString('hex');

    const userData: any = {};
    if (eventData.email) userData.em = this.hashData(eventData.email.toLowerCase().trim());
    if (eventData.phone) userData.ph = this.hashData(eventData.phone.replace(/\D/g, ''));
    if (eventData.firstName) userData.fn = this.hashData(eventData.firstName.toLowerCase().trim());
    if (eventData.lastName) userData.ln = this.hashData(eventData.lastName.toLowerCase().trim());
    if (eventData.city) userData.ct = this.hashData(eventData.city.toLowerCase().trim());
    if (eventData.state) userData.st = this.hashData(eventData.state.toLowerCase().trim());
    if (eventData.zip) userData.zp = this.hashData(eventData.zip.toLowerCase().trim());
    if (eventData.country) userData.country = this.hashData(eventData.country.toLowerCase().trim());

    const customData: any = {
      currency: eventData.currency,
      value: eventData.value,
    };
    if (eventData.contentIds?.length) customData.content_ids = eventData.contentIds;
    if (eventData.contents?.length) {
      customData.contents = eventData.contents;
      customData.num_items = eventData.contents.reduce((sum, item) => sum + item.quantity, 0);
    }

    const eventPayload = {
      event_name: 'InitiateCheckout',
      event_time: eventData.eventTime,
      event_id: eventId,
      action_source: 'other', // Pas 'website' car on n'a pas client_user_agent côté serveur
      user_data: userData,
      custom_data: customData,
    };

    return this.sendEvent('InitiateCheckout', pixelId, accessToken, eventPayload);
  }

  /**
   * Envoie un événement Purchase à Meta Conversion API
   */
  async sendPurchaseEvent(params: {
    pixelId: string;
    accessToken: string;
    eventData: {
      eventTime: number; // Unix timestamp en secondes
      eventId?: string; // ID unique pour déduplication
      userAgent?: string;
      userIp?: string;
      email?: string;
      phone?: string;
      firstName?: string;
      lastName?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
      currency: string;
      value: number; // Montant total en devise
      contentIds?: string[]; // IDs des produits
      contentName?: string;
      contentType?: string;
      contents?: Array<{
        id: string;
        quantity: number;
        item_price: number;
      }>;
      fbp?: string; // Cookie _fbp (client-side)
      fbc?: string; // Cookie _fbc (client-side)
    };
  }): Promise<{ success: boolean; eventId?: string; error?: string }> {
    const { pixelId, accessToken, eventData } = params;

    // Générer un event_id unique si non fourni (pour déduplication)
    const eventId = eventData.eventId || crypto.randomBytes(16).toString('hex');

    // Construire l'objet user_data avec hachage
    const userData: any = {};

    if (eventData.email) {
      userData.em = this.hashData(eventData.email.toLowerCase().trim());
    }

    if (eventData.phone) {
      userData.ph = this.hashData(eventData.phone.replace(/\D/g, ''));
    }

    if (eventData.firstName) {
      userData.fn = this.hashData(eventData.firstName.toLowerCase().trim());
    }

    if (eventData.lastName) {
      userData.ln = this.hashData(eventData.lastName.toLowerCase().trim());
    }

    if (eventData.city) {
      userData.ct = this.hashData(eventData.city.toLowerCase().trim());
    }

    if (eventData.state) {
      userData.st = this.hashData(eventData.state.toLowerCase().trim());
    }

    if (eventData.zip) {
      userData.zp = this.hashData(eventData.zip.toLowerCase().trim());
    }

    if (eventData.country) {
      userData.country = this.hashData(eventData.country.toLowerCase().trim());
    }

    if (eventData.userIp) {
      userData.client_ip_address = eventData.userIp;
    }

    if (eventData.userAgent) {
      userData.client_user_agent = eventData.userAgent;
    }

    if (eventData.fbp) {
      userData.fbp = eventData.fbp;
    }

    if (eventData.fbc) {
      userData.fbc = eventData.fbc;
    }

    // Construire l'objet custom_data
    const customData: any = {
      currency: eventData.currency,
      value: eventData.value,
    };

    if (eventData.contentIds && eventData.contentIds.length > 0) {
      customData.content_ids = eventData.contentIds;
    }

    if (eventData.contentName) {
      customData.content_name = eventData.contentName;
    }

    if (eventData.contentType) {
      customData.content_type = eventData.contentType;
    }

    if (eventData.contents && eventData.contents.length > 0) {
      customData.contents = eventData.contents;
      customData.num_items = eventData.contents.reduce((sum, item) => sum + item.quantity, 0);
    }

    // Construire le payload de l'événement
    const eventPayload = {
      event_name: 'Purchase',
      event_time: eventData.eventTime,
      event_id: eventId,
      action_source: 'website',
      user_data: userData,
      custom_data: customData,
    };

    const result = await this.sendEvent('Purchase', pixelId, accessToken, eventPayload);
    return { ...result, eventId };
  }

  /**
   * Vérifie si un client est nouveau (première commande)
   */
  async isNewCustomer(email: string, storeId: string, prisma: any): Promise<boolean> {
    const existingOrders = await prisma.order.count({
      where: {
        storeId,
        customerEmail: email,
        paymentStatus: 'SUCCESS',
      },
    });

    return existingOrders === 0;
  }

  /**
   * Hash des données utilisateur selon les standards Meta (SHA-256)
   */
  private hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

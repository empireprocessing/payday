import { Controller, Post, Req, Headers, BadRequestException, RawBodyRequest } from '@nestjs/common';
import { PspService } from '../psp/psp.service';
import Stripe from 'stripe';
import { Request } from 'express';

@Controller('stripe-webhook')
export class StripeWebhookController {
  private stripe: Stripe;

  constructor(private readonly pspService: PspService) {
    const key = process.env.STRIPE_PLATFORM_SECRET_KEY;
    if (key) {
      this.stripe = new Stripe(key, { typescript: true });
    }
  }

  @Post()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET not configured');
    }

    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      console.error('⚠️ Webhook signature verification failed:', (err as Error).message);
      throw new BadRequestException('Invalid webhook signature');
    }

    console.log(`📩 Stripe webhook: ${event.type} (${event.id})`);

    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await this.pspService.handleStripeAccountUpdate(account.id, account);
        break;
      }

      case 'account.application.deauthorized': {
        const application = event.data.object as Stripe.Application;
        // The account ID is in the event's account field
        if (event.account) {
          await this.pspService.handleStripeAccountDeauthorized(event.account);
        }
        break;
      }

      default:
        console.log(`ℹ️ Unhandled webhook event: ${event.type}`);
    }

    return { received: true };
  }
}

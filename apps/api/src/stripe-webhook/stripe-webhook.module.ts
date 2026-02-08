import { Module } from '@nestjs/common';
import { StripeWebhookController } from './stripe-webhook.controller';
import { PspModule } from '../psp/psp.module';

@Module({
  imports: [PspModule],
  controllers: [StripeWebhookController],
})
export class StripeWebhookModule {}

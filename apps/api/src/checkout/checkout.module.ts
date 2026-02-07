import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { CheckoutEventsController } from './checkout-events.controller';
import { CheckoutEventsService } from './checkout-events.service';
import { CommonModule } from '../common/common.module';
import { ShopifyModule } from '../shopify/shopify.module';
import { StoreModule } from '../store/store.module';
import { WoocommerceModule } from '../woocommerce/woocommerce.module';

@Module({
  imports: [CommonModule, ShopifyModule, StoreModule, WoocommerceModule],
  controllers: [CheckoutController, CheckoutEventsController],
  providers: [CheckoutService, CheckoutEventsService],
  exports: [CheckoutService, CheckoutEventsService],
})
export class CheckoutModule {}


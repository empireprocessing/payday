import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PspModule } from '../psp/psp.module';
import { OrderModule } from '../order/order.module';
import { StoreModule } from '../store/store.module';
import { ShopifyModule } from '../shopify/shopify.module';
import { WoocommerceModule } from '../woocommerce/woocommerce.module';
import { RoutingModule } from '../routing/routing.module';
import { MetaModule } from '../meta/meta.module';

@Module({
  imports: [PspModule, OrderModule, StoreModule, ShopifyModule, WoocommerceModule, RoutingModule, MetaModule],
  providers: [PaymentService],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}

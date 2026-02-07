import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { PspModule } from './psp/psp.module';
import { PaymentModule } from './payment/payment.module';
import { OrderModule } from './order/order.module';
import { StoreModule } from './store/store.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ShopifyModule } from './shopify/shopify.module';
import { RoutingModule } from './routing/routing.module';
import { StorePspModule } from './store-psp/store-psp.module';
import { PayDomainModule } from './pay-domain/pay-domain.module';
import { DnsModule } from './dns/dns.module';
import { CheckoutModule } from './checkout/checkout.module';
import { WoocommerceModule } from './woocommerce/woocommerce.module';
import { MetaModule } from './meta/meta.module';
import { PspListModule } from './psp-list/psp-list.module';
import { BasisTheoryModule } from './basis-theory/basis-theory.module';

@Module({
  imports: [ScheduleModule.forRoot(), CommonModule, PspModule, PaymentModule, OrderModule, StoreModule, AnalyticsModule, ShopifyModule, RoutingModule, StorePspModule, PayDomainModule, DnsModule, CheckoutModule, WoocommerceModule, MetaModule, PspListModule, BasisTheoryModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

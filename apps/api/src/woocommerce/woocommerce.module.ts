import { Module } from '@nestjs/common';
import { WoocommerceService } from './woocommerce.service';
import { WoocommerceController } from './woocommerce.controller';
import { PrismaService } from '../common/prisma.service';

@Module({
  providers: [WoocommerceService, PrismaService],
  controllers: [WoocommerceController],
  exports: [WoocommerceService],
})
export class WoocommerceModule {}

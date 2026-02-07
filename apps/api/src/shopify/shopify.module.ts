import { Module } from '@nestjs/common'
import { ShopifyService } from './shopify.service'
import { ShopifyController } from './shopify.controller'
import { PrismaService } from '../common/prisma.service'

@Module({
  providers: [ShopifyService, PrismaService],
  controllers: [ShopifyController],
  exports: [ShopifyService],
})
export class ShopifyModule {}

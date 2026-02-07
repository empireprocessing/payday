import { Controller, Post, Get, Body, Param, ValidationPipe } from '@nestjs/common'
import { OrderService } from './order.service'
import { CreateOrderDto } from './dto/create-order.dto'

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async createOrder(@Body(ValidationPipe) createOrderDto: CreateOrderDto) {
    return await this.orderService.createOrder(createOrderDto)
  }

  @Get(':id')
  async getOrder(@Param('id') orderId: string) {
    return await this.orderService.getOrderById(orderId)
  }
}

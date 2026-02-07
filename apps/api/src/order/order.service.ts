import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { CreateOrderDto } from './interfaces/order.interface'
import { PaymentStatus } from '@prisma/client'

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) {}

  // Créer une nouvelle commande
  async createOrder(data: CreateOrderDto) {
    return await this.prisma.order.create({
      data: {
        storeId: data.storeId,
        customerEmail: data.customerEmail,
        subtotal: data.subtotal,
        shippingCost: data.shippingCost,
        totalAmount: data.totalAmount,
        currency: data.currency || 'USD',
        items: {
          create: data.items.map(item => ({
            productId: String(item.productId), // Convert to string for Prisma
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            name: item.name,
            description: item.description,
            image: item.image,
          })),
        },
      },
      include: {
        items: true,
      },
    })
  }

  // Mettre à jour le statut d'une commande
  async updateOrderStatus(orderId: string, paymentStatus: PaymentStatus) {
    return await this.prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus,
        updatedAt: new Date(),
      },
    })
  }

  // Récupérer une commande par son ID
  async getOrderById(orderId: string) {
    return await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payments: true,
      },
    })
  }
}

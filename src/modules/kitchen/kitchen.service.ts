import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '@modules/orders/entities/order.entity';
import { OrderStatus } from '@modules/orders/entities/order-status.enum';

@Injectable()
export class KitchenService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async getActiveOrders(businessId: string) {
    const orders = await this.orderRepository.find({
      where: { businessId },
      relations: ['items', 'items.product', 'items.product.kitchenStation', 'table'],
      order: { createdAt: 'DESC' },
    });

    return orders.filter((order) =>
      [OrderStatus.CONFIRMED, OrderStatus.IN_KITCHEN, OrderStatus.READY].includes(order.status),
    );
  }
}

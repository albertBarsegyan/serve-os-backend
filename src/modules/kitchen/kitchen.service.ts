import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '@modules/orders/entities/order.entity';

@Injectable()
export class KitchenService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async getActiveOrders(businessId: string) {
    const orders = await this.orderRepository.find({
      where: { businessId },
      relations: ['items', 'items.product', 'table'],
      order: { createdAt: 'DESC' },
    });

    return orders.filter((order) =>
      [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY].includes(order.status),
    );
  }
}

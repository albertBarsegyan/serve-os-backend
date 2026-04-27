import { Injectable } from '@nestjs/common';
import { OrdersService } from '@modules/orders/orders.service';
import { OrderStatus } from '@modules/orders/entities/order.entity';

@Injectable()
export class KitchenService {
  constructor(private readonly ordersService: OrdersService) {}

  async getActiveOrders(businessId: string) {
    const orders = await this.ordersService.findAll(businessId);
    return orders.filter((order) =>
      [
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        OrderStatus.READY,
      ].includes(order.status),
    );
  }
}

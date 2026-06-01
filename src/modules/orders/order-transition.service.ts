import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { OrderStatus } from './entities/order-status.enum';
import { OrderType } from './entities/order-type.enum';
import { StaffRole } from '@common/enums/staff-role.enum';

const TERMINAL_STATUSES = new Set<OrderStatus>([
  OrderStatus.CLOSED,
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
]);

@Injectable()
export class OrderTransitionService {
  private readonly transitions: Record<OrderType, Record<OrderStatus, OrderStatus[]>> = {
    [OrderType.DINE_IN]: {
      [OrderStatus.CREATED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.IN_KITCHEN, OrderStatus.CANCELLED],
      [OrderStatus.IN_KITCHEN]: [OrderStatus.READY, OrderStatus.CANCELLED],
      [OrderStatus.READY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED]: [
        OrderStatus.CLOSED,
        OrderStatus.PAYMENT_FAILED,
        OrderStatus.REFUNDED,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.PAYMENT_FAILED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.CLOSED]: [],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUNDED]: [],
    },
    [OrderType.TAKEAWAY]: {
      [OrderStatus.CREATED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.IN_KITCHEN, OrderStatus.CANCELLED],
      [OrderStatus.IN_KITCHEN]: [OrderStatus.READY, OrderStatus.CANCELLED],
      [OrderStatus.READY]: [
        OrderStatus.CLOSED,
        OrderStatus.PAYMENT_FAILED,
        OrderStatus.REFUNDED,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.PAYMENT_FAILED]: [],
      [OrderStatus.CLOSED]: [],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUNDED]: [],
    },
    [OrderType.DELIVERY]: {
      [OrderStatus.CREATED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.IN_KITCHEN, OrderStatus.CANCELLED],
      [OrderStatus.IN_KITCHEN]: [OrderStatus.READY, OrderStatus.CANCELLED],
      [OrderStatus.READY]: [OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.PAYMENT_FAILED]: [],
      [OrderStatus.CLOSED]: [],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUNDED]: [],
    },
  };

  assertTransition(type: OrderType, current: OrderStatus, next: OrderStatus): void {
    if (next === OrderStatus.CANCELLED && !TERMINAL_STATUSES.has(current)) {
      return;
    }

    const allowed = this.transitions[type]?.[current] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(`Invalid status transition from ${current} to ${next}`);
    }
  }

  assertCancellationPermission(role: StaffRole | null | undefined, current: OrderStatus): void {
    if (current === OrderStatus.CLOSED || current === OrderStatus.REFUNDED) {
      throw new ForbiddenException('Closed or refunded orders cannot be cancelled');
    }

    if (!role) {
      throw new ForbiddenException('Staff role is required to cancel order');
    }

    if (role === StaffRole.MANAGER) {
      return;
    }

    if (
      role === StaffRole.WAITER &&
      [OrderStatus.CREATED, OrderStatus.CONFIRMED].includes(current)
    ) {
      return;
    }

    throw new ForbiddenException('You are not allowed to cancel this order at current state');
  }
}

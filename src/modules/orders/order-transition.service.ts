import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { OrderStatus } from './entities/order-status.enum';
import { OrderType } from './entities/order-type.enum';
import { StaffRole } from '@common/enums/staff-role.enum';
import { Order } from './entities/order.entity';

const TERMINAL_STATUSES = new Set<OrderStatus>([
  OrderStatus.CLOSED,
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
]);

export type TransitionActor = StaffRole | 'customer' | 'system';

// Roles allowed to drive each non-cancel transition; 'system' always permitted.
const ROLE_TRANSITIONS: Partial<Record<OrderStatus, TransitionActor[]>> = {
  [OrderStatus.CONFIRMED]: [StaffRole.WAITER, StaffRole.MANAGER, 'system'],
  [OrderStatus.IN_KITCHEN]: [StaffRole.KITCHEN, StaffRole.MANAGER, 'system'],
  [OrderStatus.READY]: [StaffRole.KITCHEN, StaffRole.MANAGER, 'system'],
  [OrderStatus.DELIVERED]: [StaffRole.WAITER, StaffRole.KITCHEN, StaffRole.MANAGER, 'system'],
  [OrderStatus.CLOSED]: [StaffRole.CASHIER, StaffRole.MANAGER, 'system'],
  [OrderStatus.PAYMENT_FAILED]: ['system'],
  [OrderStatus.REFUNDED]: ['system'],
};

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

  assertKitchenTransitionPermission(role: StaffRole | null | undefined, next: OrderStatus): void {
    if (role !== StaffRole.KITCHEN) return;

    const allowed: OrderStatus[] = [
      OrderStatus.IN_KITCHEN,
      OrderStatus.READY,
      OrderStatus.DELIVERED,
    ];
    if (!allowed.includes(next)) {
      throw new ForbiddenException(
        'Kitchen staff may only advance orders to In Kitchen, Ready, or Delivered',
      );
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

  /**
   * Validates the transition and the actor's permission, then mutates the order
   * in-memory (sets status + milestone timestamp). The caller is responsible for saving.
   */
  transition(order: Order, next: OrderStatus, actor: TransitionActor = 'system'): void {
    this.assertTransition(order.type, order.status, next);

    if (next === OrderStatus.CANCELLED) {
      this.assertCancelActor(order.status, actor);
    } else {
      const allowed = ROLE_TRANSITIONS[next];
      if (allowed && !allowed.includes(actor)) {
        throw new ForbiddenException(
          `Actor with role "${actor}" cannot transition order to ${next}`,
        );
      }
    }

    const now = new Date();
    switch (next) {
      case OrderStatus.CONFIRMED:
        order.confirmedAt = now;
        break;
      case OrderStatus.IN_KITCHEN:
        order.preparationStartedAt = now;
        break;
      case OrderStatus.READY:
        order.readyAt = now;
        break;
      case OrderStatus.DELIVERED:
        order.servedAt = now;
        break;
      case OrderStatus.CANCELLED:
        order.cancelledAt = now;
        break;
    }

    order.status = next;
  }

  private assertCancelActor(current: OrderStatus, actor: TransitionActor): void {
    if (TERMINAL_STATUSES.has(current)) {
      throw new ForbiddenException('Terminal orders cannot be cancelled');
    }

    if (actor === 'system') return;

    if (actor === 'customer') {
      if (current !== OrderStatus.CREATED) {
        throw new ForbiddenException(
          'Customers can only cancel orders that have not yet been confirmed',
        );
      }
      return;
    }

    if (actor === StaffRole.MANAGER) return;

    if (
      actor === StaffRole.WAITER &&
      [OrderStatus.CREATED, OrderStatus.CONFIRMED].includes(current)
    ) {
      return;
    }

    throw new ForbiddenException('You are not allowed to cancel this order at its current state');
  }
}

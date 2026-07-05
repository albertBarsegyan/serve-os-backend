import { Order } from '@modules/orders/entities/order.entity';
import { OrderStatus } from '@modules/orders/entities/order-status.enum';

export type DisplayOrderBucket = 'PREPARING' | 'READY';

/** Statuses a venue TV display is ever allowed to show. */
export const DISPLAYABLE_ORDER_STATUSES = [
  OrderStatus.CONFIRMED,
  OrderStatus.IN_KITCHEN,
  OrderStatus.READY,
] as const;

export interface DisplayOrderItemPayload {
  name: string;
  quantity: number;
}

export interface DisplayOrderPayload {
  orderId: string;
  tableNumber: number | null;
  status: DisplayOrderBucket;
  items: DisplayOrderItemPayload[];
  updatedAt: string;
}

export function toDisplayBucket(status: OrderStatus): DisplayOrderBucket {
  return status === OrderStatus.READY ? 'READY' : 'PREPARING';
}

/**
 * Strips an Order down to only what a public, unauthenticated TV display may show —
 * no customer name, totals, payment info, or staff identities.
 */
export function buildDisplayOrderPayload(order: Order): DisplayOrderPayload {
  return {
    orderId: order.id,
    tableNumber: order.table?.number ?? null,
    status: toDisplayBucket(order.status),
    items: (order.items ?? []).map((item) => ({
      name: item.product?.name ?? '',
      quantity: item.quantity,
    })),
    updatedAt: order.updatedAt.toISOString(),
  };
}

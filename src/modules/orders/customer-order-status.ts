import { OrderStatus } from './entities/order-status.enum';

export type CustomerOrderStatus =
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'cancelled';

const MAP: Record<OrderStatus, CustomerOrderStatus> = {
  [OrderStatus.CREATED]: 'placed',
  [OrderStatus.CONFIRMED]: 'confirmed',
  [OrderStatus.IN_KITCHEN]: 'preparing',
  [OrderStatus.READY]: 'ready',
  [OrderStatus.DELIVERED]: 'served',
  [OrderStatus.CLOSED]: 'served',
  [OrderStatus.CANCELLED]: 'cancelled',
  [OrderStatus.PAYMENT_FAILED]: 'served',
  [OrderStatus.REFUNDED]: 'cancelled',
};

export function toCustomerStatus(status: OrderStatus): CustomerOrderStatus {
  return MAP[status];
}

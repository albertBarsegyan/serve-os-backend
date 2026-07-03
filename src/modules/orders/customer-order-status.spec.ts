import { toCustomerStatus } from './customer-order-status';
import { OrderStatus } from './entities/order-status.enum';

describe('toCustomerStatus', () => {
  it.each([
    [OrderStatus.CREATED, 'placed'],
    [OrderStatus.CONFIRMED, 'confirmed'],
    [OrderStatus.IN_KITCHEN, 'preparing'],
    [OrderStatus.READY, 'ready'],
    [OrderStatus.DELIVERED, 'served'],
    [OrderStatus.CLOSED, 'served'],
    [OrderStatus.CANCELLED, 'cancelled'],
    [OrderStatus.PAYMENT_FAILED, 'payment_failed'],
    [OrderStatus.REFUNDED, 'refunded'],
  ])('maps %s to %s', (status, expected) => {
    expect(toCustomerStatus(status)).toBe(expected);
  });

  it('covers every OrderStatus value with no gaps', () => {
    const allStatuses = Object.values(OrderStatus);
    for (const status of allStatuses) {
      expect(() => toCustomerStatus(status)).not.toThrow();
      expect(toCustomerStatus(status)).toBeDefined();
    }
  });
});

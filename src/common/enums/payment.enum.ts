export enum PaymentMethod {
  CASH = 'CASH',
  POS = 'POS',
  ONLINE = 'ONLINE',
}

/**
 * Payment status from the perspective of an Order (whether order has been paid)
 */
export enum OrderPaymentStatus {
  UNPAID = 'UNPAID',
  PAID = 'PAID',
}

/**
 * Payment lifecycle status for actual Payment records
 */
export enum PaymentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

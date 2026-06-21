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
  PENDING = 'PENDING',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

/**
 * Payment lifecycle status for actual Payment records
 */
export enum PaymentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

/**
 * Determines when money must be captured relative to kitchen dispatch.
 * PREPAID  — provider confirms funds before IN_KITCHEN.
 * ON_PREMISE — staff confirms order first; payment settled at table or counter.
 */
export enum CaptureTiming {
  PREPAID = 'PREPAID',
  ON_PREMISE = 'ON_PREMISE',
}

/**
 * How the backend learns a PREPAID payment succeeded.
 * callback — provider POSTs to our webhook.
 * poll     — we poll provider on a schedule.
 * manual   — staff marks it paid manually (fallback / cash-equivalent).
 */
export enum CallbackMode {
  CALLBACK = 'callback',
  POLL = 'poll',
  MANUAL = 'manual',
}

/**
 * Typed shape of BusinessPaymentMethod.config (stored as jsonb).
 * Each payment method entry carries its provider name, capture timing,
 * and optional provider-specific fields.
 */
export interface PaymentMethodConfig {
  provider: string;
  captureTiming: CaptureTiming;
  credentialsRef?: string;
  callbackMode?: CallbackMode;
}

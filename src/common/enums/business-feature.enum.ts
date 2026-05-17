/**
 * BusinessFeature enum - Capability-driven feature flags.
 * Each business has a set of enabled features that determine what operations are allowed.
 * This design keeps the system extensible and capability-driven rather than type-driven.
 *
 * Usage: Instead of checking "if business.type === RESTAURANT", check
 * "if business.features.includes(BusinessFeature.TABLES)"
 */
export enum BusinessFeature {
  TABLES = 'TABLES',
  QR_ORDERING = 'QR_ORDERING',
  DELIVERY = 'DELIVERY',
  TAKEAWAY = 'TAKEAWAY',
  DINE_IN = 'DINE_IN',

  KITCHEN = 'KITCHEN',
  KDS = 'KDS',

  RESERVATIONS = 'RESERVATIONS',
  ROOM_BOOKING = 'ROOM_BOOKING',

  BAR_MENU = 'BAR_MENU',
  ALCOHOL_SERVICE = 'ALCOHOL_SERVICE',

  ONLINE_PAYMENT = 'ONLINE_PAYMENT',
  CASH_PAYMENT = 'CASH_PAYMENT',
  POS_PAYMENT = 'POS_PAYMENT',

  STAFF_MANAGEMENT = 'STAFF_MANAGEMENT',
  INVENTORY = 'INVENTORY',

  EVENTS = 'EVENTS',
  MEMBERSHIP = 'MEMBERSHIP',

  MULTI_BRANCH = 'MULTI_BRANCH',
}

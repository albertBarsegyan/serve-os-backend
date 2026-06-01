import { BusinessType } from './business-type.enum';

/**
 * BusinessFeature enum - Capability-driven feature flags.
 * Each business has a set of enabled features that determine what operations are allowed.
 * This design keeps the system extensible and capability-driven rather than type-driven.
 *
 * Usage: Instead of checking "if business.type === RESTAURANT", check
 * "if business.features.includes(BusinessFeature.TABLES)"
 */
export enum BusinessFeature {
  // Core
  TABLES = 'tables',
  QR_ORDERING = 'qr_ordering',
  KITCHEN = 'kitchen',
  KDS = 'kds',

  // Order types
  ORDER_DINE_IN = 'order_dine_in',
  ORDER_TAKEAWAY = 'order_takeaway',
  ORDER_DELIVERY = 'order_delivery',

  // Addons
  ALLERGEN_LABELS = 'allergen_labels',
  HAPPY_HOUR = 'happy_hour',
  TIPS = 'tips',
  SPLIT_BILL = 'split_bill',
}

export const FEATURE_META: Record<BusinessFeature, { isCore: boolean; label: string }> = {
  [BusinessFeature.TABLES]: { isCore: true, label: 'Tables & QR' },
  [BusinessFeature.QR_ORDERING]: { isCore: true, label: 'QR Ordering' },
  [BusinessFeature.KITCHEN]: { isCore: true, label: 'Kitchen' },
  [BusinessFeature.KDS]: { isCore: true, label: 'Kitchen Display' },
  [BusinessFeature.ORDER_DINE_IN]: { isCore: true, label: 'Dine In' },
  [BusinessFeature.ORDER_TAKEAWAY]: { isCore: true, label: 'Takeaway' },
  [BusinessFeature.ORDER_DELIVERY]: { isCore: false, label: 'Delivery' },
  [BusinessFeature.ALLERGEN_LABELS]: { isCore: false, label: 'Allergen Labels' },
  [BusinessFeature.HAPPY_HOUR]: { isCore: false, label: 'Happy Hour' },
  [BusinessFeature.TIPS]: { isCore: false, label: 'Tips' },
  [BusinessFeature.SPLIT_BILL]: { isCore: false, label: 'Split Bill' },
};

export const FEATURE_PRESETS: Record<BusinessType, BusinessFeature[]> = {
  [BusinessType.RESTAURANT]: [
    BusinessFeature.TABLES,
    BusinessFeature.QR_ORDERING,
    BusinessFeature.KITCHEN,
    BusinessFeature.KDS,
    BusinessFeature.ORDER_DINE_IN,
    BusinessFeature.ORDER_TAKEAWAY,
    BusinessFeature.ALLERGEN_LABELS,
    BusinessFeature.TIPS,
    BusinessFeature.SPLIT_BILL,
  ],
  [BusinessType.CAFE]: [
    BusinessFeature.TABLES,
    BusinessFeature.QR_ORDERING,
    BusinessFeature.ORDER_DINE_IN,
    BusinessFeature.ORDER_TAKEAWAY,
    BusinessFeature.TIPS,
  ],
  [BusinessType.BAR]: [
    BusinessFeature.TABLES,
    BusinessFeature.QR_ORDERING,
    BusinessFeature.ORDER_DINE_IN,
    BusinessFeature.HAPPY_HOUR,
    BusinessFeature.TIPS,
  ],
  [BusinessType.FAST_FOOD]: [
    BusinessFeature.KITCHEN,
    BusinessFeature.KDS,
    BusinessFeature.ORDER_TAKEAWAY,
    BusinessFeature.ORDER_DELIVERY,
  ],
  [BusinessType.FOOD_TRUCK]: [
    BusinessFeature.KITCHEN,
    BusinessFeature.ORDER_TAKEAWAY,
    BusinessFeature.ORDER_DELIVERY,
  ],
  [BusinessType.HOTEL]: [
    BusinessFeature.TABLES,
    BusinessFeature.QR_ORDERING,
    BusinessFeature.ORDER_DINE_IN,
    BusinessFeature.ALLERGEN_LABELS,
    BusinessFeature.TIPS,
    BusinessFeature.SPLIT_BILL,
  ],
  [BusinessType.OTHER]: [BusinessFeature.TABLES],
};

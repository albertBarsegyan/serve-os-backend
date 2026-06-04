import { BusinessType } from '../enums/business-type.enum';
import { BusinessFeature } from '../enums/business-feature.enum';

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
    // Core
    BusinessFeature.TABLES,
    BusinessFeature.QR_ORDERING,
    BusinessFeature.KITCHEN,
    BusinessFeature.KDS,
    BusinessFeature.ORDER_DINE_IN,
    BusinessFeature.ORDER_TAKEAWAY,
    // Addons
    BusinessFeature.ALLERGEN_LABELS,
    BusinessFeature.TIPS,
    BusinessFeature.SPLIT_BILL,
  ],
  [BusinessType.CAFE]: [
    // Core
    BusinessFeature.TABLES,
    BusinessFeature.QR_ORDERING,
    BusinessFeature.ORDER_DINE_IN,
    BusinessFeature.ORDER_TAKEAWAY,
    // Addons
    BusinessFeature.TIPS,
  ],
  [BusinessType.BAR]: [
    // Core
    BusinessFeature.TABLES,
    BusinessFeature.QR_ORDERING,
    BusinessFeature.ORDER_DINE_IN,

    // Addons
    BusinessFeature.HAPPY_HOUR,
    BusinessFeature.TIPS,
  ],
  [BusinessType.FAST_FOOD]: [
    // Core
    BusinessFeature.KITCHEN,
    BusinessFeature.KDS,
    BusinessFeature.ORDER_TAKEAWAY,
    // Addons
    BusinessFeature.ORDER_DELIVERY,
  ],
  [BusinessType.FOOD_TRUCK]: [
    // Core
    BusinessFeature.KITCHEN,
    BusinessFeature.ORDER_TAKEAWAY,

    // Addons
    BusinessFeature.ORDER_DELIVERY,
  ],
  [BusinessType.HOTEL]: [
    // Core
    BusinessFeature.TABLES,
    BusinessFeature.QR_ORDERING,
    BusinessFeature.ORDER_DINE_IN,
    // Addons
    BusinessFeature.ALLERGEN_LABELS,
    BusinessFeature.TIPS,
    BusinessFeature.SPLIT_BILL,
  ],
  [BusinessType.EVENT_VENUE]: [
    // Core
    BusinessFeature.TABLES,
    BusinessFeature.QR_ORDERING,
    BusinessFeature.ORDER_DINE_IN,
    // Addons
    BusinessFeature.ALLERGEN_LABELS,
    BusinessFeature.TIPS,
    BusinessFeature.SPLIT_BILL,
  ],
  [BusinessType.OTHER]: [
    // Core
    BusinessFeature.TABLES,
  ],
};

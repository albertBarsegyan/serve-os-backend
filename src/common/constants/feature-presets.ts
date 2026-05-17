import { BusinessType } from '@common/enums/business-type.enum';
import { BusinessFeature } from '@common/enums/business-feature.enum';

/**
 * FEATURE_PRESETS
 *
 * Centralized mapping from BusinessType to default enabled features.
 * When creating a new business, if features are not explicitly provided,
 * the preset for that BusinessType is used.
 *
 * This provides consistency and backward compatibility:
 * - Existing restaurants get typical restaurant features (tables, kitchen, etc.)
 * - New business types can be added without code changes
 * - Clients can still override with custom features during business creation
 *
 * Rule: Prefer composition over conditionals.
 * Instead of: if (business.type === RESTAURANT) enableTables()
 * Use:        if (business.features.includes(TABLES)) enableTables()
 */
export const FEATURE_PRESETS: Record<BusinessType, BusinessFeature[]> = {
  [BusinessType.RESTAURANT]: [
    BusinessFeature.TABLES,
    BusinessFeature.QR_ORDERING,
    BusinessFeature.KITCHEN,
    BusinessFeature.KDS,
    BusinessFeature.DINE_IN,
    BusinessFeature.TAKEAWAY,
    BusinessFeature.CASH_PAYMENT,
    BusinessFeature.POS_PAYMENT,
  ],
  [BusinessType.CAFE]: [
    BusinessFeature.TABLES,
    BusinessFeature.QR_ORDERING,
    BusinessFeature.CASH_PAYMENT,
    BusinessFeature.POS_PAYMENT,
    BusinessFeature.DINE_IN,
  ],
  [BusinessType.BAR]: [
    BusinessFeature.TABLES,
    BusinessFeature.BAR_MENU,
    BusinessFeature.ALCOHOL_SERVICE,
    BusinessFeature.POS_PAYMENT,
  ],
  [BusinessType.PUB]: [
    BusinessFeature.TABLES,
    BusinessFeature.ALCOHOL_SERVICE,
    BusinessFeature.POS_PAYMENT,
  ],
  [BusinessType.HOTEL]: [
    BusinessFeature.ROOM_BOOKING,
    BusinessFeature.ONLINE_PAYMENT,
    BusinessFeature.STAFF_MANAGEMENT,
  ],
  [BusinessType.BAKERY]: [],
  [BusinessType.FAST_FOOD]: [
    BusinessFeature.TAKEAWAY,
    BusinessFeature.DELIVERY,
    BusinessFeature.CASH_PAYMENT,
  ],
  [BusinessType.FOOD_TRUCK]: [BusinessFeature.TAKEAWAY, BusinessFeature.CASH_PAYMENT],
  [BusinessType.PIZZERIA]: [
    BusinessFeature.DELIVERY,
    BusinessFeature.TAKEAWAY,
    BusinessFeature.POS_PAYMENT,
  ],
  [BusinessType.STEAKHOUSE]: [
    BusinessFeature.TABLES,
    BusinessFeature.POS_PAYMENT,
    BusinessFeature.DINE_IN,
  ],
  [BusinessType.SEAFOOD_RESTAURANT]: [
    BusinessFeature.TABLES,
    BusinessFeature.DINE_IN,
    BusinessFeature.POS_PAYMENT,
  ],
  [BusinessType.SUSHI_BAR]: [
    BusinessFeature.TABLES,
    BusinessFeature.DINE_IN,
    BusinessFeature.POS_PAYMENT,
  ],
  [BusinessType.BUFFET]: [
    BusinessFeature.TABLES,
    BusinessFeature.DINE_IN,
    BusinessFeature.CASH_PAYMENT,
  ],
  [BusinessType.ICE_CREAM_SHOP]: [BusinessFeature.CASH_PAYMENT, BusinessFeature.TAKEAWAY],
  [BusinessType.JUICE_BAR]: [BusinessFeature.CASH_PAYMENT, BusinessFeature.TAKEAWAY],
  [BusinessType.COFFEE_SHOP]: [
    BusinessFeature.TABLES,
    BusinessFeature.DINE_IN,
    BusinessFeature.CASH_PAYMENT,
  ],
  [BusinessType.TEA_HOUSE]: [BusinessFeature.TABLES],
  [BusinessType.WINE_BAR]: [BusinessFeature.TABLES, BusinessFeature.ALCOHOL_SERVICE],
  [BusinessType.COCKTAIL_BAR]: [BusinessFeature.TABLES, BusinessFeature.ALCOHOL_SERVICE],
  [BusinessType.BREWERY]: [
    BusinessFeature.TABLES,
    BusinessFeature.BAR_MENU,
    BusinessFeature.ALCOHOL_SERVICE,
  ],
  [BusinessType.NIGHTCLUB]: [BusinessFeature.EVENTS],
  [BusinessType.HOSTEL]: [BusinessFeature.ROOM_BOOKING, BusinessFeature.ONLINE_PAYMENT],
  [BusinessType.RESORT]: [BusinessFeature.ROOM_BOOKING, BusinessFeature.ONLINE_PAYMENT],
  [BusinessType.MOTEL]: [BusinessFeature.ROOM_BOOKING],
  [BusinessType.GUEST_HOUSE]: [BusinessFeature.ROOM_BOOKING],
  [BusinessType.APARTMENT_HOTEL]: [BusinessFeature.ROOM_BOOKING],
  [BusinessType.CASINO]: [BusinessFeature.EVENTS, BusinessFeature.MEMBERSHIP],
  [BusinessType.LOUNGE]: [BusinessFeature.BAR_MENU, BusinessFeature.ALCOHOL_SERVICE],
  [BusinessType.KARAOKE]: [BusinessFeature.EVENTS, BusinessFeature.BAR_MENU],
  [BusinessType.CINEMA]: [BusinessFeature.EVENTS],
  [BusinessType.EVENT_VENUE]: [BusinessFeature.EVENTS],
  [BusinessType.CATERING]: [BusinessFeature.EVENTS],
  [BusinessType.BANQUET_HALL]: [BusinessFeature.EVENTS],
  [BusinessType.PRIVATE_CLUB]: [BusinessFeature.MEMBERSHIP],
  [BusinessType.OTHER]: [],
};

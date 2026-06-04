/**
 * BusinessType enum - Descriptive classification of hospitality business types.
 * Used for categorizing businesses but NOT for determining feature availability.
 * Feature availability is controlled by BusinessFeature flags that are stored separately.
 *
 * This design allows future businesses to be added without changing the codebase's feature logic.
 */
export enum BusinessType {
  RESTAURANT = 'RESTAURANT',
  CAFE = 'CAFE',
  BAR = 'BAR',
  FAST_FOOD = 'FAST_FOOD',
  FOOD_TRUCK = 'FOOD_TRUCK',
  HOTEL = 'HOTEL',
  EVENT_VENUE = 'EVENT_VENUE',
  OTHER = 'OTHER',
}

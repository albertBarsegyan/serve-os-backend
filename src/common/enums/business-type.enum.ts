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
  PUB = 'PUB',
  BAKERY = 'BAKERY',
  FAST_FOOD = 'FAST_FOOD',
  FOOD_TRUCK = 'FOOD_TRUCK',
  PIZZERIA = 'PIZZERIA',
  STEAKHOUSE = 'STEAKHOUSE',
  SEAFOOD_RESTAURANT = 'SEAFOOD_RESTAURANT',
  SUSHI_BAR = 'SUSHI_BAR',
  BUFFET = 'BUFFET',
  ICE_CREAM_SHOP = 'ICE_CREAM_SHOP',
  JUICE_BAR = 'JUICE_BAR',
  COFFEE_SHOP = 'COFFEE_SHOP',
  TEA_HOUSE = 'TEA_HOUSE',
  WINE_BAR = 'WINE_BAR',
  COCKTAIL_BAR = 'COCKTAIL_BAR',
  BREWERY = 'BREWERY',
  NIGHTCLUB = 'NIGHTCLUB',

  HOTEL = 'HOTEL',
  HOSTEL = 'HOSTEL',
  RESORT = 'RESORT',
  MOTEL = 'MOTEL',
  GUEST_HOUSE = 'GUEST_HOUSE',
  APARTMENT_HOTEL = 'APARTMENT_HOTEL',

  CASINO = 'CASINO',
  LOUNGE = 'LOUNGE',
  KARAOKE = 'KARAOKE',
  CINEMA = 'CINEMA',
  EVENT_VENUE = 'EVENT_VENUE',

  CATERING = 'CATERING',
  BANQUET_HALL = 'BANQUET_HALL',
  PRIVATE_CLUB = 'PRIVATE_CLUB',

  OTHER = 'OTHER',
}

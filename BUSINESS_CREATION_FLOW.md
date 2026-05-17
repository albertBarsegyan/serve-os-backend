# Business Creation Flow API Contract

This document is intended for frontend implementation of the business creation flow.
It reflects the current NestJS + TypeORM backend contract for business management.

## High-level flow

1. User registers or logs in.
2. Frontend submits a business creation request to `POST /business`.
3. Backend creates the business and applies default features based on `type` when `features` is not provided.
4. Frontend can fetch/update/delete the business later using the business management endpoints.

---

## Base endpoint

All business routes are under:

```http
/business
```

---

## Enums

### `BusinessType`

```ts
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
```

### `BusinessFeature`

Business behavior is capability-driven. Frontend should treat features as the source of truth for enabling UI and workflows.

```ts
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
```

---

## Feature presets

If `features` is not sent in the create request, backend applies defaults based on `type`.

### Example presets

#### `RESTAURANT`
- `TABLES`
- `QR_ORDERING`
- `KITCHEN`
- `KDS`
- `DINE_IN`
- `TAKEAWAY`
- `CASH_PAYMENT`
- `POS_PAYMENT`

#### `HOTEL`
- `ROOM_BOOKING`
- `ONLINE_PAYMENT`
- `STAFF_MANAGEMENT`

#### `BAR`
- `TABLES`
- `BAR_MENU`
- `ALCOHOL_SERVICE`
- `POS_PAYMENT`

#### `CAFE`
- `TABLES`
- `QR_ORDERING`
- `CASH_PAYMENT`
- `POS_PAYMENT`
- `DINE_IN`

Frontend can use this as a starting point, but the backend remains the source of truth.

---

## Request types

### `CreateBusinessRequest`

```ts
export interface CreateBusinessRequest {
  name: string;
  type: BusinessType;
  location: string;
  currency: string;
  workingHours?: Record<string, string> | unknown;
  features?: BusinessFeature[];
}
```

### `UpdateBusinessRequest`

```ts
export interface UpdateBusinessRequest {
  name?: string;
  type?: BusinessType;
  location?: string;
  currency?: string;
  workingHours?: Record<string, string> | unknown;
  isActive?: boolean;
  features?: BusinessFeature[];
}
```

---

## Response types

### `BusinessResponse`

This is the typical business object returned by the backend.

```ts
export interface BusinessResponse {
  id: string;
  name: string;
  type: BusinessType;
  features: BusinessFeature[];
  location: string;
  currency: string;
  workingHours?: Record<string, string> | unknown | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  owner?: unknown;
}
```

Notes:
- `owner` is usually not loaded in the current service methods.
- `ownerId` exists on the entity and may be required by the database.
- Timestamps are ISO strings in JSON responses.

---

## Endpoints

## 1) Create business

### `POST /business`

Public endpoint in the current backend.

#### Request body

```json
{
  "name": "Sunset Bistro",
  "type": "RESTAURANT",
  "location": "123 Main St, New York",
  "currency": "USD",
  "workingHours": {
    "monday": "09:00-22:00",
    "tuesday": "09:00-22:00"
  }
}
```

#### With explicit features

```json
{
  "name": "Sky Lounge",
  "type": "BAR",
  "location": "45 Sunset Ave, Dubai",
  "currency": "AED",
  "features": ["TABLES", "BAR_MENU", "ALCOHOL_SERVICE", "POS_PAYMENT"]
}
```

#### Success response `201 Created`

```json
{
  "id": "b1b5b6d6-0a9c-4c55-a7fb-d84c1a92a2f1",
  "name": "Sunset Bistro",
  "type": "RESTAURANT",
  "features": ["TABLES", "QR_ORDERING", "KITCHEN", "KDS", "DINE_IN", "TAKEAWAY", "CASH_PAYMENT", "POS_PAYMENT"],
  "location": "123 Main St, New York",
  "currency": "USD",
  "workingHours": {
    "monday": "09:00-22:00",
    "tuesday": "09:00-22:00"
  },
  "isActive": true,
  "createdAt": "2026-05-16T10:00:00.000Z",
  "updatedAt": "2026-05-16T10:00:00.000Z",
  "ownerId": "owner-user-id"
}
```

#### Validation rules
- `name` is required string
- `type` is required and must be a valid `BusinessType`
- `location` is required string
- `currency` is required string
- `features` is optional array of `BusinessFeature`
- `workingHours` is optional and currently untyped on backend (`any`)

#### Important behavior
- If `features` is omitted, backend applies default features from the feature preset for the selected `type`.
- Frontend should not assume business capabilities from `type` alone.

---

## 2) Get all businesses

### `GET /business`

Requires role: `OWNER`

#### Success response `200 OK`

```json
[
  {
    "id": "b1b5b6d6-0a9c-4c55-a7fb-d84c1a92a2f1",
    "name": "Sunset Bistro",
    "type": "RESTAURANT",
    "features": ["TABLES", "QR_ORDERING", "KITCHEN", "KDS", "DINE_IN", "TAKEAWAY", "CASH_PAYMENT", "POS_PAYMENT"],
    "location": "123 Main St, New York",
    "currency": "USD",
    "workingHours": null,
    "isActive": true,
    "createdAt": "2026-05-16T10:00:00.000Z",
    "updatedAt": "2026-05-16T10:00:00.000Z",
    "ownerId": "owner-user-id"
  }
]
```

---

## 3) Get business by ID

### `GET /business/:id`

Requires role: `OWNER`

#### Success response `200 OK`

```json
{
  "id": "b1b5b6d6-0a9c-4c55-a7fb-d84c1a92a2f1",
  "name": "Sunset Bistro",
  "type": "RESTAURANT",
  "features": ["TABLES", "QR_ORDERING", "KITCHEN", "KDS", "DINE_IN", "TAKEAWAY", "CASH_PAYMENT", "POS_PAYMENT"],
  "location": "123 Main St, New York",
  "currency": "USD",
  "workingHours": null,
  "isActive": true,
  "createdAt": "2026-05-16T10:00:00.000Z",
  "updatedAt": "2026-05-16T10:00:00.000Z",
  "ownerId": "owner-user-id"
}
```

#### Error response `404 Not Found`

```json
{
  "statusCode": 404,
  "message": "Business with ID b1b5b6d6-0a9c-4c55-a7fb-d84c1a92a2f1 not found",
  "error": "Not Found"
}
```

---

## 4) Update business

### `PATCH /business/:id`

Requires role: `OWNER`

#### Request body

```json
{
  "name": "Sunset Bistro Updated",
  "features": ["TABLES", "QR_ORDERING", "KITCHEN", "KDS", "DINE_IN", "TAKEAWAY", "CASH_PAYMENT", "POS_PAYMENT"]
}
```

#### Success response `200 OK`

Returns the updated business object.

```json
{
  "id": "b1b5b6d6-0a9c-4c55-a7fb-d84c1a92a2f1",
  "name": "Sunset Bistro Updated",
  "type": "RESTAURANT",
  "features": ["TABLES", "QR_ORDERING", "KITCHEN", "KDS", "DINE_IN", "TAKEAWAY", "CASH_PAYMENT", "POS_PAYMENT"],
  "location": "123 Main St, New York",
  "currency": "USD",
  "workingHours": null,
  "isActive": true,
  "createdAt": "2026-05-16T10:00:00.000Z",
  "updatedAt": "2026-05-16T11:15:00.000Z",
  "ownerId": "owner-user-id"
}
```

---

## 5) Delete business

### `DELETE /business/:id`

Requires role: `OWNER`

#### Success response `200 OK`

```json
{
  "message": "ok"
}
```

---

## Frontend implementation notes

### 1. Do not rely on business type for UI permissions
Use `features` to determine whether to show or hide modules.

Examples:
- show table management only if `features.includes('TABLES')`
- show kitchen dashboard only if `features.includes('KITCHEN')`
- show room booking only if `features.includes('ROOM_BOOKING')`

### 2. Normalize feature checks in one place
Create a frontend helper like:

```ts
export const hasFeature = (
  business: BusinessResponse | null | undefined,
  feature: BusinessFeature,
) => Boolean(business?.features?.includes(feature));
```

### 3. Use `type` only for display / analytics / onboarding copy
`type` is descriptive and should not drive capability logic.

### 4. Handle optional `features`
If the API returns no features for any reason, treat it as `[]` in the UI.

---

## Suggested frontend types

```ts
export type BusinessId = string;

export interface BusinessFormValues {
  name: string;
  type: BusinessType;
  location: string;
  currency: string;
  workingHours?: Record<string, string>;
  features?: BusinessFeature[];
}

export interface BusinessState {
  currentBusiness: BusinessResponse | null;
  loading: boolean;
  error?: string | null;
}
```

---

## Example create flow

```ts
const payload: CreateBusinessRequest = {
  name: 'Moonlight Cafe',
  type: BusinessType.CAFE,
  location: '88 River Road, London',
  currency: 'GBP',
};

const response = await api.post<BusinessResponse>('/business', payload);

// response.data.features will include preset features if not explicitly sent
```

---

## Important backend caveat

The current backend `POST /business` implementation does not request `ownerId` in the body.
If the database schema requires `ownerId` and it is not injected elsewhere, business creation may fail until the backend flow is completed.

For frontend work, treat the contract above as the intended API shape.
If you need, I can also produce a companion document for the auth/register flow and a combined onboarding flow for frontend.

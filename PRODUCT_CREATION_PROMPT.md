# Product Creation Flow — Frontend Prompt

Checklist for the frontend developer
- [ ] Implement UI form that collects product and optional variant data according to the request shape below
- [ ] Validate input client-side to match the server validation rules before sending
- [ ] Send requests to the documented endpoints and handle success/error responses
- [ ] If slug is user-provided, allow the user to edit; otherwise show generated slug returned by the server
- [ ] Show friendly error messages for 400/401/403/404/409 responses

Purpose

Give this document to your frontend developer(s). It fully describes the product creation endpoint(s) and the request/response types, including enums and sample payloads. The backend will perform server-side validation and will generate a unique slug if one is not provided.

Authentication / Authorization
- All endpoints require a Bearer token in the `Authorization` header.
- The backend uses a unified auth payload with two principal types: owner and staff.
  - Owner: access to all businesses they own
  - Staff: access only to their `businessId`
- Product creation requires the caller to be either the owner of the business or a staff member belonging to that business with permission to manage menu/products.

Base URL (example)
- API base: `https://api.example.com`
- Example products endpoint prefix: `/api/businesses/:businessId/products`

Endpoints

1) Create product
- Method: POST
- Path: /api/businesses/:businessId/products
- Auth: Bearer token (UnifiedAuthGuard) — owner or staff authorized for the business
- Request body: `CreateProductRequest` (see TypeScript interface below)
- Success response: 201 Created — returns `ProductResponse`
- Error responses:
  - 400 Bad Request — validation failed
  - 401 Unauthorized — missing/invalid token
  - 403 Forbidden — staff not authorized or owner mismatch
  - 404 Not Found — category or business not found

2) Get product list
- Method: GET
- Path: /api/businesses/:businessId/products
- Auth: Bearer token
- Success response: 200 OK — array of `ProductResponse`

3) Get single product
- Method: GET
- Path: /api/businesses/:businessId/products/:productId
- Auth: Bearer token
- Success response: 200 OK — `ProductResponse`
- 404 Not Found — product not found or not in business

4) Update product
- Method: PUT
- Path: /api/businesses/:businessId/products/:productId
- Auth: Bearer token
- Request body: `UpdateProductRequest` (partial of create)
- Success response: 200 OK — `ProductResponse`
- Error responses: 400/401/403/404 as above

5) Delete product
- Method: DELETE
- Path: /api/businesses/:businessId/products/:productId
- Auth: Bearer token
- Success response: 204 No Content
- Error responses: 401/403/404

TypeScript types (copy into frontend types)

```ts
// Enums (values must match backend enums)
export enum ServicePeriod {
  ALL_DAY = 'all_day',
  BREAKFAST = 'breakfast',
  LUNCH = 'lunch',
  DINNER = 'dinner',
}

export enum DietaryFlag {
  VEGAN = 'vegan',
  VEGETARIAN = 'vegetarian',
  GLUTEN_FREE = 'gluten_free',
  HALAL = 'halal',
  KOSHER = 'kosher',
}

export enum Allergen {
  NUTS = 'nuts',
  DAIRY = 'dairy',
  SOY = 'soy',
  EGG = 'egg',
  SHELLFISH = 'shellfish',
}

// Variant DTO used in the create request
export interface CreateProductVariantDto {
  name: string; // required
  price: number; // required, >= 0.01
  sku?: string | null;
  isAvailable?: boolean; // default true
  sortOrder?: number; // default 0
}

export interface CreateProductRequest {
  categoryId: string; // UUID of category (required)
  name: string; // required
  description?: string | null;
  basePrice: number; // required, >= 0.01
  compareAtPrice?: number | null; // optional
  slug?: string | null; // optional; if omitted server will generate unique slug scoped to business
  sku?: string | null;
  prepTimeMinutes?: number; // optional, min 1, max 180
  availablePeriod?: ServicePeriod; // optional
  sortOrder?: number;
  isFeatured?: boolean;
  dietaryFlags?: DietaryFlag[]; // optional, elements must be valid DietaryFlag
  allergens?: Allergen[]; // optional
  imageUrls?: string[]; // optional, each must be a valid URL
  variants?: CreateProductVariantDto[]; // optional
}

export type UpdateProductRequest = Partial<CreateProductRequest>;

// Response shapes returned by the API
export interface ProductVariantResponse {
  id: string; // uuid
  productId: string;
  name: string;
  price: number;
  sku?: string | null;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface ProductResponse {
  id: string;
  businessId: string;
  categoryId: string;
  name: string;
  description?: string | null;
  price: number; // "basePrice" mapped to this field on the backend
  compareAtPrice?: number | null;
  slug: string;
  sku?: string | null;
  prepTimeMinutes: number;
  availablePeriod: ServicePeriod;
  sortOrder: number;
  isFeatured: boolean;
  dietaryFlags: string[];
  allergens: string[];
  imageUrls: string[];
  totalOrderCount: number;
  averageRating: number;
  variants: ProductVariantResponse[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}
```

Client-side validation rules (mirror server validation)
- `categoryId`: required, UUID
- `name`: required, non-empty string
- `basePrice`: required, number >= 0.01
- `compareAtPrice`: optional, if provided must be >= 0.01
- `slug`: optional string, allow letters/numbers/dashes; if empty on submit, let server generate
- `prepTimeMinutes`: optional integer between 1 and 180
- `availablePeriod`: optional, must be one of ServicePeriod enum values
- `imageUrls`: optional array of valid URLs
- `variants`: optional array; each variant must have `name` (string) and `price` (>= 0.01)

Slug generation behavior (backend contract)
- If `slug` is omitted or an empty string, backend will generate one from `name` using the `slugify` package with options `{ lower: true, strict: true }`.
- The backend ensures the slug is unique scoped to the same `businessId`. If a generated slug already exists the backend will append `-2`, `-3`, etc. until unique.
- Frontend can optimistically show an auto-generated slug client-side, but must prefer the server-provided slug returned in the created resource.

Edge cases and notes
- Concurrency: the backend has a unique index (`businessId`, `slug`) — in extremely rare races the server may retry slug generation or respond with a 409; the frontend should present an informative message and allow the user to edit the slug and retry.
- Variants: backend creates variants via cascade insert on product creation. Provide `variants` array in the create body; omit `id` and `productId` (server will set these).
- Currency/precision: prices are stored as decimal(10,2). Send numeric values (floating) in requests; server will coerce/validate.
- Returned timestamps are ISO strings. Parse accordingly.

Sample request (create product)

```json
POST /api/businesses/7d9f3b3a-.../products
Authorization: Bearer <token>
Content-Type: application/json

{
  "categoryId": "c1a2b3d4-...",
  "name": "Classic Burger",
  "description": "Beef patty, lettuce, tomato",
  "basePrice": 12.5,
  "compareAtPrice": 15.0,
  "slug": null,
  "sku": "BURGER-001",
  "prepTimeMinutes": 12,
  "availablePeriod": "all_day",
  "isFeatured": true,
  "dietaryFlags": ["halal"],
  "allergens": ["dairy"],
  "imageUrls": ["https://cdn.example.com/images/burger.jpg"],
  "variants": [
    { "name": "Regular", "price": 12.5 },
    { "name": "Large", "price": 14.5 }
  ]
}
```

Sample success response (201)

```json
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "e1a2b3c4-...",
  "businessId": "7d9f3b3a-...",
  "categoryId": "c1a2b3d4-...",
  "name": "Classic Burger",
  "description": "Beef patty, lettuce, tomato",
  "price": 12.5,
  "compareAtPrice": 15.0,
  "slug": "classic-burger",
  "sku": "BURGER-001",
  "prepTimeMinutes": 12,
  "availablePeriod": "all_day",
  "sortOrder": 0,
  "isFeatured": true,
  "dietaryFlags": ["halal"],
  "allergens": ["dairy"],
  "imageUrls": ["https://cdn.example.com/images/burger.jpg"],
  "totalOrderCount": 0,
  "averageRating": 0,
  "variants": [
    {
      "id": "v1-...",
      "productId": "e1a2b3c4-...",
      "name": "Regular",
      "price": 12.5,
      "sku": null,
      "isAvailable": true,
      "sortOrder": 0,
      "createdAt": "2026-05-29T12:00:00.000Z",
      "updatedAt": "2026-05-29T12:00:00.000Z"
    }
  ],
  "createdAt": "2026-05-29T12:00:00.000Z",
  "updatedAt": "2026-05-29T12:00:00.000Z",
  "deletedAt": null
}
```

Error response examples

400 Bad Request (validation)

```json
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "statusCode": 400,
  "message": ["name must be a string", "basePrice must be >= 0.01"],
  "error": "Bad Request"
}
```

401 Unauthorized (missing/invalid token)

```json
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

403 Forbidden (not allowed)

```json
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "statusCode": 403,
  "message": "Staff access required or insufficient permissions"
}
```

404 Not Found (category/business)

```json
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "statusCode": 404,
  "message": "Category with ID c1a2b3d4-... not found"
}
```

cURL example

```bash
curl -X POST "https://api.example.com/api/businesses/7d9f3b3a-.../products" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"categoryId":"c1a2b3d4-...","name":"Classic Burger","basePrice":12.5}'
```

Developer notes for frontend integration
- Validate on the client to reduce roundtrips; but always display server validation messages as authoritative.
- After creating a product, use the returned `slug` and `id` for subsequent editing links and image upload flows.
- If the backend returns a 409 due to slug unique index collision (rare), provide a UI to edit the slug and retry.
- When showing variant prices in the UI, format to two decimal places to match backend precision.

If you want, I can also:
- produce a TypeScript file containing these interfaces and enums ready to drop into your frontend repo,
- or generate an OpenAPI/Swagger snippet for these endpoints so the frontend can auto-generate client code.


---
Generated on May 29, 2026


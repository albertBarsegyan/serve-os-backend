# Frontend API Contract (excluding Auth & Business Creation)

This document is a frontend-facing API contract for implementing the application features (everything except authentication and business creation). It lists endpoints, required request shapes, response shapes, examples, and common error cases. All endpoints require a valid JWT Bearer token unless noted.

Notes
- Base URL: /api (adjust if your frontend proxies differently)
- Auth: JWT in `Authorization: Bearer <token>` header
 - Tenant/Business context: the frontend MUST send the active business id in the `x-business-id` HTTP header on requests that operate within a business context. The backend will NOT rely on businessId stored in the JWT.
   - Header name: `x-business-id`
   - Value: UUID string of the active business (e.g. `b3e1f6aa-...`). If the user has no business (onboarding state), omit the header or send an empty value.
   - The Tenant middleware reads `x-business-id` and normalizes it; tenant-protected routes will validate the user's access server-side.
- Validation: The backend returns 400 for invalid requests, 401 for unauthorized, 403 for forbidden (roles / features), and 404 for not found.

Common Enums (frontend types)

- Role
  - "OWNER" | "ADMIN" | "WAITER" | "CHEF"

- BusinessFeature
  - "TABLES","QR_ORDERING","DELIVERY","TAKEAWAY","DINE_IN",
  "KITCHEN","KDS","RESERVATIONS","ROOM_BOOKING","BAR_MENU",
  "ALCOHOL_SERVICE","ONLINE_PAYMENT","CASH_PAYMENT","POS_PAYMENT",
  "STAFF_MANAGEMENT","INVENTORY","EVENTS","MEMBERSHIP","MULTI_BRANCH"

- PaymentMethod
  - "CASH" | "POS" | "ONLINE"

- PaymentStatus (backend payments module)
  - "PENDING" | "CONFIRMED" | "FAILED"

- OrderStatus
  - "PENDING" | "CONFIRMED" | "PREPARING" | "READY" | "DELIVERED" | "CLOSED" | "CANCELLED"

---

Customer Sessions (QR flow)

1) Create customer session (frontend obtains token from QR URL first; this endpoint reserved for staff to open a session or backend may expose QR that encodes token)

- Method: POST
- Path: /api/customer-sessions
- Auth: Bearer
- Purpose: Staff opens an anonymous session for a table or pre-provisioned QR flow.

Request (CreateCustomerSessionRequest)
{
  "businessId": "uuid", // optional; server can infer
  "tableId": "uuid",
  "expiresAt": "ISO_TIMESTAMP" // optional
}

Response (CustomerSession)
{
  "id": "uuid",
  "businessId": "uuid",
  "tableId": "uuid",
  "token": "uuid-token-string",
  "expiresAt": "ISO_TIMESTAMP",
  "isActive": true,
  "createdAt": "ISO_TIMESTAMP"
}

Errors
- 400: validation errors
- 403: feature disabled (TABLES or QR_ORDERING)

2) Get session by token (used by customer web app)

- Method: GET
- Path: /api/customer-sessions/token/:token
- Auth: none (token is publicized in QR)

Response: CustomerSession (same as above) or 404

---

Tables

Description: Manage tables (requires BusinessFeature.TABLES)

1) Create table
- Method: POST
- Path: /api/tables
- Auth: Bearer (OWNER/ADMIN)

Request (CreateTableRequest)
{
  "number": 12,            // integer
  "capacity": 4,          // integer
  "qrCode": "string",   // unique token string used in QR
  "isActive": true
}

Response (Table)
{
  "id":"uuid",
  "businessId":"uuid",
  "number":12,
  "qrCode":"string",
  "capacity":4,
  "isActive":true,
  "createdAt":"ISO_TS",
  "updatedAt":"ISO_TS"
}

Errors
- 400: validation errors
- 403: TABLES feature not enabled
- 409: qrCode conflict (duplicate)

2) List tables
- Method: GET
- Path: /api/tables
- Auth: Bearer

Response: Table[]

3) Get table by id
- Method: GET
- Path: /api/tables/:id
- Auth: Bearer or public if using token endpoint

4) Update table
- Method: PATCH
- Path: /api/tables/:id
- Auth: Bearer

Request (UpdateTableRequest) - any of the fields above optional

5) Delete table
- Method: DELETE
- Path: /api/tables/:id
- Auth: Bearer

---

Menu & Catalog

Menu is composed of MenuCategory (menu_categories) and Product (products). Products may be linked to ModifierGroups.

Menu Category Endpoints

1) Create category
- Method: POST
- Path: /api/menu/categories
- Auth: Bearer (OWNER/ADMIN)

Request (CreateMenuCategoryRequest)
{
  "name": "Starters",
  "sortOrder": 0
}

Response (MenuCategory)
{
  "id":"uuid",
  "businessId":"uuid",
  "name":"Starters",
  "sortOrder":0,
  "products":[],
}

2) List categories
- Method: GET
- Path: /api/menu/categories
- Auth: Bearer

Response: MenuCategory[] (each may include products if query param includeProducts=true)

Product Endpoints

1) Create product
- Method: POST
- Path: /api/menu/products
- Auth: Bearer (OWNER/ADMIN)

Request (CreateProductRequest)
{
  "name": "Margherita",
  "description": "...",
  "price": "9.99", // string decimal or number (backend expects decimal)
  "categoryId": "uuid",
  "imageUrl": "https://...",
  "isAvailable": true,
  "allergens": ["milk","gluten"] ,
  "modifierGroupIds": ["uuid", ...] // optional
}

Response (Product)
{
  "id":"uuid",
  "businessId":"uuid",
  "categoryId":"uuid",
  "name":"Margherita",
  "description":"...",
  "price":"9.99",
  "imageUrl":"...",
  "isAvailable":true,
  "allergens":["milk","gluten"],
  "modifierGroups":[{id: 'uuid', name: 'Size', selectionType:'SINGLE', ... }]
}

2) List products
- Method: GET
- Path: /api/menu/products
- Auth: Bearer or public (for customer UI read-only)
- Query params: categoryId, availableOnly=true

Response: Product[]

3) Update / Delete product
- PATCH /api/menu/products/:id
- DELETE /api/menu/products/:id
- Auth: Bearer (OWNER/ADMIN)

---

Modifiers (ModifierGroup, Modifier, OrderItemModifier)

Modifier Group Endpoints

1) Create modifier group
- Method: POST
- Path: /api/modifier-groups
- Auth: Bearer (OWNER/ADMIN)

Request
{
  "name": "Size",
  "selectionType": "SINGLE|MULTIPLE",
  "isRequired": false,
  "minSelections": 1,
  "maxSelections": 1,
  "position": 0,
  "isActive": true
}

Response: ModifierGroup with `modifiers` array

2) Add modifier to group
- POST /api/modifier-groups/:groupId/modifiers

Request
{
  "name": "Large",
  "priceAdjustment": "2.00",
  "position": 0,
  "isActive": true
}

Response: Modifier

3) Attach group(s) to product
- POST /api/menu/products/:productId/modifier-groups
- Body: { modifierGroupIds: ["uuid", ...] }

---

Orders

Important: Orders are capability-driven. Creating an order requires BusinessFeature.TABLES or QR_ORDERING depending on source.

Create Order (customer or staff)
- Method: POST
- Path: /api/orders
- Auth: Bearer for staff; for customer flows, the customer session token is used.

Request (CreateOrderRequest)
{
  // if customer flow: sessionToken is required and tableId optional
  "customerSessionToken": "uuid-token", // OR
  "tableId": "uuid",
  "items": [
    {
      "productId": "uuid",
      "quantity": 2,
      "unitPrice": "9.99", // frontend should send the price snapshot (or backend can look it up)
      "notes": "No onions",
      "selectedModifierIds": ["modifierId1", "modifierId2"]
    }
  ],
  "paymentMethod": "CASH|POS|ONLINE" // optional at creation
}

Response (Order)
{
  "id":"uuid",
  "businessId":"uuid",
  "tableId":"uuid",
  "waiterId": "uuid|null",
  "status":"PENDING",
  "paymentMethod":null,
  "paymentStatus":"UNPAID",
  "totalAmount":"19.98",
  "items":[ { "id":"uuid","productId":"...","quantity":2,"unitPrice":"9.99","notes":"...","selectedModifiers":[{modifierId,name,priceAdjustment}]} ],
  "createdAt":"ISO_TS"
}

Errors
- 403: TABLES or QR_ORDERING feature disabled
- 400: invalid productId or missing sessionToken

Update Order Status (used by staff/chef)
- Method: PATCH
- Path: /api/orders/:id/status
- Auth: Bearer (roles: WAITER/ADMIN/OWNER/CHEF depending on transition)

Request
{
  "status": "PREPARING|READY|DELIVERED|CLOSED|CANCELLED"
}

Response: updated Order

Add/modify items
- PATCH /api/orders/:id/items
- Request: { items: [...] } (same shape as Create) — backend merges changes

List orders
- GET /api/orders?status=PREPARING&tableId=...&limit=20&offset=0

Get order details
- GET /api/orders/:id

---

Kitchen (KDS) & Tickets

Create kitchen ticket (triggered when order item is confirmed)
- This typically is internal when an order is created/confirmed. Frontend for kitchen (chef UI) will need endpoints to:
  - list tickets: GET /api/kitchen/tickets?status=PREPARING|READY
  - claim/assign: PATCH /api/kitchen/tickets/:id/assign { stationId, chefId }
  - update ticket status: PATCH /api/kitchen/tickets/:id/status { status: 'PREPARING'|'READY' }

Ticket shape (KitchenTicket)
{
  "id":"uuid",
  "orderId":"uuid",
  "items": [ { orderItemId, productId, productName, notes, quantity, kitchenStationId } ],
  "status":"PREPARING|READY|CANCELLED",
  "createdAt":"ISO_TS"
}

Permissions: Chef UIs must check BusinessFeature.KITCHEN / KDS

---

Payments

Create Payment (customer or staff)
- Method: POST
- Path: /api/payments
- Auth: Bearer (staff) or public callback for ONLINE gateways

Request (CreatePaymentRequest)
{
  "orderId": "uuid",
  "method": "CASH|POS|ONLINE",
  "amount": "19.98",
  // for POS or CASH: confirmedBy (staffId) may be set by staff endpoint when confirming
  "metadata": { ... } // gateway-specific
}

Response (Payment)
{
  "id":"uuid",
  "businessId":"uuid",
  "orderId":"uuid",
  "method":"ONLINE",
  "status":"PENDING",
  "amount":"19.98",
  "confirmedAt": null,
  "confirmedBy": null,
  "createdAt":"ISO_TS"
}

Confirm Payment (POS / CASH confirmed by staff)
- Method: POST
- Path: /api/payments/:id/confirm
- Auth: Bearer (staff)

Request
{ "confirmedBy": "staffId" }

Response: updated Payment (status CONFIRMED, confirmedAt set)

Online gateway callbacks
- POST /api/payments/webhook/:provider
- No auth (provider signs request). Use this to mark ONLINE payments as CONFIRMED/FAILED.

Errors
- 400: invalid amounts
- 403: ONLINE_PAYMENT or CASH_PAYMENT not enabled for business

---

Staff & Invitations

Staff Invite (owner/admin invites an email)

1) Create invite
- POST /api/staff/invites
- Auth: Bearer (OWNER/ADMIN)

Request
{
  "email": "cook@example.com",
  "role": "CHEF|WAITER|ADMIN",
  "expiresAt": "ISO_TS" // optional
}

Response (StaffInvite)
{
  "id":"uuid",
  "businessId":"uuid",
  "invitedBy":"staffId",
  "email":"cook@example.com",
  "role":"CHEF",
  "token":"uuid-token",
  "expiresAt":"ISO_TS",
  "isAccepted":false,
  "createdAt":"ISO_TS"
}

2) Accept invite (frontend flow on invite link)
- GET /api/staff/invites/accept/:token  -> returns invite details
- Then frontend directs user to registration flow (auth is handled outside this doc). After the user registers, backend will link user→staff automatically and mark invite accepted.

Staff management
- List staff: GET /api/staff
- Get staff: GET /api/staff/:id
- Update staff role: PATCH /api/staff/:id { role }
- Remove staff: DELETE /api/staff/:id

Permissions: only OWNER/ADMIN (depending on rule) allowed to create/remove staff

---

Business Payment Methods (which methods are enabled)

List payment methods for business
- GET /api/business/payment-methods
- Auth: Bearer

Create/Update business payment method
- POST /api/business/payment-methods
Request
{
  "method": "CASH|POS|ONLINE",
  "isActive": true,
  "config": { ... }
}

Response: BusinessPaymentMethod

---

Feature Guard Notes (frontend integration)

Some endpoints will return 403 if a business doesn't have the required feature enabled. The frontend should gracefully handle this:
- Hide UI controls for features that are disabled (use GET /api/business to fetch `features` and `type`).
- If the feature list is not available in the session, call the business info endpoint once at app bootstrap.

---

Errors & Conventions

- Validation errors: 400 with body { errors: [ { field, message } ] }
- Unauthorized: 401
- Forbidden: 403
- Not Found: 404
- Conflict: 409 (e.g., duplicate QR code)

Timestamps: ISO 8601 strings
Decimal amounts: strings or numbers — prefer strings to avoid float issues (e.g., "19.99")
UUIDs: strings

---

Examples

Create Order example (customer)
POST /api/orders
Authorization: Bearer <jwt> (if staff) or sessionToken used by customer

Request
{
  "customerSessionToken": "0f1e2d3c-...",
  "items": [
    {
      "productId": "11111111-2222-3333-4444-555555555555",
      "quantity": 1,
      "unitPrice": "9.99",
      "selectedModifierIds": ["mod-1","mod-2"]
    }
  ]
}

Response 201
{
  "id":"order-uuid",
  "totalAmount":"9.99",
  "status":"PENDING",
  "items":[...]
}


Developer notes for frontend implementers
- Use the business info endpoint to fetch `features` and hide/disable UI controls accordingly.
- Always present currency/locale (returned by `business.currency`) when showing prices.
- For payments, prefer server-side creation and return the payment object with `id` and any provider client token required.
- When showing order totals, trust backend-calculated totals. The frontend may optimistically render totals using returned snapshots, but submit full order object to server for authoritative calculation.

---

If you want, I can also generate a machine-readable OpenAPI (Swagger) spec from this contract that you can feed to codegen tools (TypeScript axios client / React hooks). Would you like that?

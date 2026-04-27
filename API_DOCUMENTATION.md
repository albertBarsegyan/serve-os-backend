# Serve-OS API Documentation for Frontend

This document provides an overview of the API structure, authentication, and tenant management for the Serve-OS platform.

## Base URL
`http://localhost:3000/api`

## Interactive Documentation (Swagger)
You can access the interactive Swagger UI at:
`http://localhost:3000/api/docs`

---

## 1. Multi-Tenancy (Business ID)
Every resource in the system belongs to a **Business (Tenant)**. 
- **Staff** carry their `businessId` within their JWT payload.
- **Guests** scan a QR code which provides a `businessId` and `tableId`.

### How to use:
For most endpoints, you don't need to manually send `businessId` in the body; the backend extracts it from your JWT. However, you MUST ensure you are authenticated.

---

## 2. Authentication

### Staff Login
**POST** `/auth/login`
- **Request Body**: `LoginDto`
- **Response**: `{ access_token: string, user: { ... } }`
- **Note**: Store the `access_token` and include it in the `Authorization: Bearer <token>` header for subsequent requests.

### Guest Access
Guests don't need to login. They scan a QR code:
**GET** `/tables/scan/:qrCode`
- Returns table info and the `businessId`.
- Use this info to place orders.

---

## 3. Key Modules & Endpoints

### Business
- `GET /business`: List all businesses.
- `GET /business/:id`: Get specific business details.

### Menu
- `GET /menu/categories`: Get all categories (includes products).
- `GET /menu/products`: Get all products.

### Orders
- `POST /orders`: Place a new order.
  - Guests use `tableId` and `sessionToken`.
  - Staff can also place orders for tables.
- `GET /orders`: Get orders for the current business.
- `PATCH /orders/:id/status`: Update status (e.g., `CONFIRMED`, `PREPARING`, `READY`).

### Kitchen (KDS)
- `GET /kitchen/active-orders`: Get orders that are currently being prepared.
- **WebSockets**: Connect to `ws://localhost:3000`
  - Event `join-kitchen`: Send `{ businessId }` to join the kitchen room.
  - Event `new-order`: Listen for new orders.
  - Event `order-status-update`: Listen for status changes.

### Payments
- `POST /payments`: Initiate a payment (Guest/Staff).
- `PATCH /payments/:id/confirm`: Manually confirm CASH/POS payment (Staff only).

---

## 4. Common Response Types

### Success
```json
{
  "id": "uuid",
  "createdAt": "2024-04-23T10:00:00Z",
  ...
}
```

### Error
```json
{
  "statusCode": 400,
  "timestamp": "2024-04-23T10:00:00Z",
  "path": "/api/orders",
  "message": "Invalid status transition"
}
```

---

## 5. Order Status Flow
1. `PENDING` (Initial state)
2. `CONFIRMED` (Staff accepts order -> Kitchen notified)
3. `PREPARING` (Kitchen starts)
4. `READY` (Kitchen finished)
5. `DELIVERED` (Waiter served)
6. `CLOSED` (Payment completed)
7. `CANCELLED` (Order aborted)

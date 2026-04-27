# Serve-OS Restaurant Management Platform Backend

Multi-tenant SaaS backend for restaurant management using NestJS, TypeORM, and PostgreSQL.

## Features

- **Multi-Tenancy**: Every resource is isolated by `businessId`.
- **Auth**: JWT-based authentication for staff and session-based access for guests via QR codes.
- **Menu Management**: Categories and products with image support.
- **Order Management**: Full status flow from PENDING to CLOSED.
- **Kitchen Display System (KDS)**: Real-time WebSocket updates for the kitchen.
- **Payments**: Support for CASH, POS, and ONLINE methods with mock webhook confirmation.

## Tech Stack

- NestJS 11+
- TypeORM + PostgreSQL
- Socket.io (WebSockets)
- Passport JWT
- Class-validator & Class-transformer

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Database Configuration**:
   Create a `.env` file or use the defaults in `AppModule`:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=postgres
   DB_DATABASE=serve_os
   JWT_SECRET=your_secret_key
   ```

3. **Run the application**:
   ```bash
   npm run start:dev
   ```

## Folder Structure

```
src/
├── common/             # Shared decorators, guards, filters, interceptors
├── modules/
│   ├── auth/           # Authentication & JWT
│   ├── business/       # Tenant management
│   ├── kitchen/        # WebSocket Gateway & KDS logic
│   ├── menu/           # Categories & Products
│   ├── orders/         # Order processing & Status flow
│   ├── payments/       # Payment processing
│   ├── staff/          # Staff roles & management
│   └── users/          # Core user accounts
└── main.ts             # App entry point
```

## Business Logic Rules

1. **Tenant Isolation**: All requests must carry a valid `businessId` in the JWT payload.
2. **Order Flow**: PENDING → CONFIRMED → PREPARING → READY → DELIVERED → CLOSED.
3. **KDS Updates**: WebSocket events are emitted on status changes (e.g., CONFIRMED).
4. **Guest Access**: Customers scan QR codes to generate a session token for ordering without login.

## License

UNLICENSED

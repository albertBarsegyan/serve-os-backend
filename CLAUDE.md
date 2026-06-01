# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev          # watch mode, hot reload
npm run build              # compile to dist/

# Testing
npm test                   # run all unit tests
npm run test:watch         # watch mode
npm run test:e2e           # end-to-end tests
npm run test:cov           # coverage report
# Run a single test file:
npx jest src/path/to/file.spec.ts

# Code quality
npm run lint               # lint + auto-fix
npm run lint:check         # lint without fix
npm run format             # prettier write
npm run format:check       # prettier check only

# Docker (preferred for dev — includes Postgres)
npm run docker:dev         # build and start all services
npm run docker:dev:stop    # stop without removing containers
npm run docker:dev:logs    # tail logs
npm run docker:dev:reset   # full wipe and restart (destroys DB data)

# Database migrations
npm run migration:generate -- --name=<migration-name>   # generate from entity diff
npm run migration:dev:run      # apply pending migrations (dev)
npm run migration:dev:revert   # revert last migration (dev)
npm run migration:dev:status   # show migration status
```

`synchronize` is always `false`. Schema changes must go through TypeORM migration files in `src/database/migrations/`.

## Path Aliases

Three path aliases are configured in `tsconfig.json`:
- `@src/*` → `src/*`
- `@common/*` → `src/common/*`
- `@modules/*` → `src/modules/*`

## Architecture Overview

This is a multi-tenant SaaS backend for restaurant/hospitality businesses (Serve-OS). Each **Business** is a tenant with its own staff, tables, menu, and orders.

### Request Lifecycle

Every request passes through this middleware/guard chain (registered globally in `AppModule`):

1. **`TenantMiddleware`** — reads `business_id` cookie, sets `req.businessId`
2. **`JwtAuthGuard`** — validates bearer token, populates `req.user` with `AuthPayload`
3. **`RolesGuard`** — enforces `@Roles()` decorator using `req.user`
4. **`TenantAccessService`** (via `TenantGuard` in individual modules) — resolves business ownership/access, populates `req.business`

### Dual Auth System

There are two distinct principal types, both carried in JWTs:

- **Owner** (`OwnerPayload`): `{ type: 'owner', userId, email }` — a `User` who registered and owns one or more businesses. Authenticated via `/api/auth/login`.
- **Staff** (`StaffPayload`): `{ type: 'staff', staffId, businessId, role }` — an employee of a specific business. Authenticated via `/api/auth/staff/login`.

The union `AuthPayload = OwnerPayload | StaffPayload` is in `src/modules/auth/types/auth-payload.type.ts`. Always discriminate on `.type` before accessing type-specific fields.

Refresh token rotation is implemented for owners: the hashed refresh token is stored in `users.refreshToken`; on reuse, all sessions are invalidated.

### Multi-Tenancy

Business context is established per-request:
- Owners: `business_id` cookie is the tenant selector; `TenantAccessService` verifies `business.ownerId === payload.userId`
- Staff: `businessId` is embedded in their JWT; the cookie is not needed

`req.business: TenantBusinessContext` is available downstream: `{ id, role, permissions }`.

Routes that are valid without a business context (e.g., business creation) use `@AllowWithoutBusiness()`. Public unauthenticated routes use `@Public()`.

### Business Feature Flags

`Business.features: BusinessFeature[]` controls what capabilities a tenant has. This replaces type-based branching. Presets per `BusinessType` are defined in `src/common/enums/business-feature.enum.ts`.

Prefer `business.features.includes(BusinessFeature.X)` over checking `business.type`.

### Staff Permissions

Granular permissions are defined in `StaffPermission` enum (`src/common/enums/staff-permission.enum.ts`). `ROLE_PERMISSION_MAP` maps each `StaffRole` to its allowed permissions, and `FEATURE_CRUD` maps each `BusinessFeature` to required permissions per CRUD action.

Staff roles: `MANAGER` (all permissions), `WAITER`, `CASHIER`, `KITCHEN`.

### Order Lifecycle

Orders follow a state machine managed by `OrderTransitionService`:

```
CREATED → CONFIRMED → IN_KITCHEN → READY → DELIVERED → CLOSED
                                                      ↘ CANCELLED
                                          PAYMENT_FAILED → REFUNDED
```

State transitions emit real-time Socket.io events via `KitchenGateway`.

### WebSocket (Real-Time)

`KitchenGateway` (Socket.io) exposes three room types:
- `kitchen:<businessId>` — kitchen display screens
- `business:<businessId>` — front-of-house / POS
- `session:<sessionToken>` — customer QR session (guest ordering flow)

Clients join rooms by emitting `join-kitchen`, `join-business`, or `join-session`.

### Module Structure

Each feature module under `src/modules/` follows: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `entities/`, `dto/`. Common cross-cutting concerns live in `src/common/`: guards, decorators, filters, middleware, enums, utils.

Key modules:
- **auth** — register/login for owners and staff, JWT refresh
- **business** — tenant CRUD, payment methods
- **tables** + **table-sessions** — physical tables and QR scan sessions (guest entry point)
- **menu** + **modifiers** — categories, products, variants, modifier groups
- **orders** — order creation (both QR guest flow and staff-initiated), status transitions, payment processing
- **payments** — payment records, webhooks
- **kitchen** — kitchen stations, WebSocket gateway for KDS
- **staff** — staff management within a business

### Swagger

API docs are served at `/api/docs` in all environments.

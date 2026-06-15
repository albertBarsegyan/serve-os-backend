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

## Image Upload

Images are stored in S3-compatible object storage (MinIO locally, Cloudflare R2 / Backblaze B2 / AWS S3 in production). Only metadata (URL, MIME type, size, uploader) is persisted in Postgres — never the raw bytes.

### Running MinIO locally

MinIO starts automatically with the dev stack:

```bash
npm run docker:dev
```

The `minio-init` container creates the `uploads` bucket and sets it public on first boot. You can also manage it via the MinIO Console at http://localhost:9001 (user: `minioadmin`, password: `minioadmin`).

### Run the migration

```bash
npm run migration:dev:run
```

### Test the upload endpoint

```bash
# Upload an image (must be authenticated — get a JWT from POST /api/auth/login first)
curl -X POST http://localhost:4000/api/images/upload \
  -H "Authorization: Bearer <your_jwt>" \
  -F "file=@/path/to/photo.jpg"

# Delete an image
curl -X DELETE http://localhost:4000/api/images/<image-id> \
  -H "Authorization: Bearer <your_jwt>"
```

### Processing pipeline

Every upload goes through:
1. Magic-byte verification via `sharp` (client-declared MIME type is ignored).
2. EXIF stripping and auto-rotation.
3. Resize to max 2000 px on the longest edge (no upscaling).
4. Re-encode to WebP at quality 85 (`CONVERT_TO_WEBP = true` in `images.constants.ts` — set to `false` to preserve original format).
5. UUID-keyed path (`{year}/{uuid}.webp`) — user filename never used.

### Switching to Cloudflare R2 in production

```bash
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY=<r2-access-key-id>
S3_SECRET_KEY=<r2-secret-access-key>
S3_BUCKET=uploads
S3_PUBLIC_URL=https://your-custom-domain-or-r2-public-url
```

R2 is S3-compatible and works with the same code path (`forcePathStyle: true` is ignored by R2 but harmless). Point `S3_PUBLIC_URL` at your R2 custom domain or CDN URL so returned image URLs are publicly reachable.

## License

UNLICENSED

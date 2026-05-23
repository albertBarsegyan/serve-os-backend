# x-business-id header (frontend contract)

This document explains how the frontend should send the active business context to the backend.

Overview
- The backend is multi-tenant. The active tenant (business) is selected in the frontend UI and must be provided to tenant-protected endpoints via the HTTP header `x-business-id`.
- Do NOT place businessId in JWTs. JWTs contain only the user subject (`sub`). The server will always validate the user's access to the requested business on every request.

Header details
- Header: `x-business-id`
- Value: UUID string (e.g. `b3e1f6aa-9c15-4f5b-8a2e-123456789abc`)
- If the user has no business (onboarding state): omit the header or send no value (server treats as `null`).

Behavior
- TenantMiddleware (server) will:
  - Read `x-business-id` from request headers.
  - Normalize and validate the UUID format.
  - Attach `request.businessId = <uuid> | null`.
- TenantGuard (server) will strictly validate that the authenticated user has access to the requested business (owner or staff) for tenant-protected routes. Onboarding routes are explicitly allowed without a `x-business-id`.
- The server rejects cross-tenant access: all queries are scoped by `businessId` on the backend.

Frontend responsibilities
- Whenever the user selects/switches a business in the UI, store the active business id in app state and include it in subsequent API requests via the `x-business-id` header.
- When the user has no business (e.g., new user onboarding), do not send the header.
- When calling public or onboarding endpoints (e.g., `/api/business/create`, `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`), you can omit the header.

Examples

- Fetch (browser):

```js
// activeBusinessId is string UUID or null
fetch('/api/menu/products', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    ...(activeBusinessId ? { 'x-business-id': activeBusinessId } : {}),
  },
  credentials: 'include', // required if relying on cookies for auth
});
```

- Axios:

```js
axios.get('/api/menu/products', {
  headers: {
    ...(activeBusinessId ? { 'x-business-id': activeBusinessId } : {}),
  },
  withCredentials: true,
});
```

- Curl (server-to-server or tests):

```bash
curl -H "x-business-id: b3e1f6aa-9c15-4f5b-8a2e-123456789abc" \
  -H "Authorization: Bearer $TOKEN" \
  https://api.example.com/api/orders
```

Onboarding flows
- For new users with no business: the header should be omitted. Server onboarding endpoints (e.g. `/api/business/create`) will create a business and return it. The frontend should set the returned business id as the active business for subsequent requests.

Security notes
- Never trust the header alone. The backend always validates that the requesting user is the owner or a staff member of the `x-business-id` provided.
- Do not send business ids that the user is not authorized to access — the request will be rejected.

Troubleshooting
- If you receive 401 from `/api/auth/me` after login, ensure you are including `credentials: 'include'` and that the backend `Set-Cookie` headers are visible in the response (browser must accept cookies). When cookies are not accepted, include a Bearer token in `Authorization`.
- If you receive 403 when switching business ids, the user likely does not have access to that business. Verify in the backend that the user has a staff record or is the owner.

Contact
- If anything is unclear, ask the backend team. They can provide example responses for your current user to verify permissions and active business lists.


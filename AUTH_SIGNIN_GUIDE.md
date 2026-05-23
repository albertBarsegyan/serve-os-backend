# Sign-In Authentication Guide & Troubleshooting

## Root Causes Identified

### 1. **SameSite Cookie Policy Issue (PRIMARY ISSUE)**
- **Problem**: Backend was setting cookies with `sameSite: 'lax'` which blocks cross-origin cookie sharing
- **Context**: Frontend at `http://localhost:3000` + Backend at `http://localhost:4000` = cross-origin requests
- **Impact**: Browsers block cookie transmission on cross-origin POST requests with `sameSite: 'lax'`
- **Solution**: Changed to `sameSite: 'none'` in development with appropriate `secure` flag

### 2. **Missing Token Fallback in Response Body**
- **Problem**: Login/Register endpoints only returned user info, not tokens
- **Context**: If cookies fail to persist, frontend has no fallback tokens to use
- **Impact**: Frontend cannot authenticate if cookies aren't working
- **Solution**: Now tokens are returned in response body AND set as cookies

### 3. **Secure Flag Misconfiguration**
- **Problem**: `secure: isProduction` was too strict for localhost development
- **Context**: `secure` flag requires HTTPS, but localhost dev uses HTTP
- **Impact**: Cookies rejected by browser even with correct SameSite policy
- **Solution**: Added localhost detection to set `secure: false` for development

---

## Backend Changes Applied

### Modified: `src/modules/auth/auth.controller.ts`

**Changed cookie settings:**
```typescript
// BEFORE (broken for development)
res.cookie('access_token', accessToken, {
  httpOnly: true,
  secure: isProduction,        // false in dev = no encryption required
  sameSite: 'lax',            // ❌ BLOCKS cross-origin cookies
  maxAge: ACCESS_TOKEN_TTL_MS,
});

// AFTER (fixed)
const isDevelopment = !isProduction;
const sameSitePolicy = isDevelopment ? 'none' : 'strict';
const corsOrigin = this.configService.get<string>('CORS_ORIGIN') || '';
const isLocalhost = corsOrigin.includes('localhost') || corsOrigin.includes('127.0.0.1');
const shouldSetSecure = !isLocalhost; // Allow non-secure for localhost

res.cookie('access_token', accessToken, {
  httpOnly: true,
  secure: shouldSetSecure,     // ✅ false for localhost, true for production
  sameSite: sameSitePolicy,    // ✅ 'none' for dev cross-origin, 'strict' for prod
  maxAge: ACCESS_TOKEN_TTL_MS,
});
```

**Response body changes:**
- Now returns tokens in response body as fallback: `{ user, tokens }`
- Previously only returned: `{ user }`

---

## Frontend Implementation Requirements

### 1. **Send Credentials on All Requests**

```typescript
// JavaScript/Fetch API
const response = await fetch('http://localhost:4000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // ✅ CRITICAL: Send/receive cookies
  body: JSON.stringify({ email, password }),
});
```

### 2. **Handle Login Response**

```typescript
// Option A: Use cookies (automatic if credentials: 'include' is set)
const data = await response.json();
const { user } = data;
// Cookies are automatically managed by browser

// Option B: Use token from response body as fallback
const data = await response.json();
const { user, tokens } = data;
if (tokens?.accessToken) {
  // Store token if cookies fail
  localStorage.setItem('accessToken', tokens.accessToken);
}
```

### 3. **Axios Configuration**

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true,  // ✅ CRITICAL: Send cookies
});

// Then use normally
const response = await api.post('/auth/login', { email, password });
```

### 4. **React Query / SWR Example**

```typescript
// With React Query
useQuery({
  queryKey: ['me'],
  queryFn: async () => {
    const res = await fetch('http://localhost:4000/api/auth/me', {
      credentials: 'include',  // ✅ Send cookies
    });
    return res.json();
  },
});

// With SWR
useSWR('/auth/me', (url) =>
  fetch(url, { credentials: 'include' }).then(r => r.json())
);
```

### 5. **Next.js API Routes (Proxy Pattern)**

For server-side rendering, proxy requests through your backend:

```typescript
// pages/api/auth/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    const response = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
      credentials: 'include',  // Forward credentials
    });

    const data = await response.json();

    // Forward cookies from backend
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      res.setHeader('Set-Cookie', setCookie);
    }

    return res.status(response.status).json(data);
  }
}
```

---

## Testing Authentication Flow

### 1. **Manual cURL Test**

```bash
# Step 1: Login and save cookies
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' \
  -c cookies.txt  # ✅ Save cookies

# Step 2: Test /me endpoint with saved cookies
curl http://localhost:4000/api/auth/me \
  -b cookies.txt  # ✅ Send cookies
```

### 2. **Browser DevTools Check**

1. Open **Application/Storage** tab
2. Click **Cookies** → Filter by `localhost:4000`
3. Look for `access_token` and `refresh_token` cookies
4. Verify:
   - ✅ `HttpOnly` is checked
   - ✅ `Secure` is checked (production) or unchecked (localhost)
   - ✅ `SameSite` is `None` (dev) or `Strict` (prod)
5. Try `/api/auth/me` endpoint - should return your user info

### 3. **Network Tab Debugging**

1. Open **Network** tab
2. Login POST request:
   - Look for `Set-Cookie` response headers
   - Should see `access_token=...` and `refresh_token=...`
3. Subsequent requests (e.g., GET `/api/auth/me`):
   - Look for `Cookie` request header
   - Should include `access_token=...`

---

## Common Issues & Solutions

### Issue 1: Cookies Not Being Set
**Symptoms**: No `Set-Cookie` headers in response, no cookies in DevTools

**Debug:**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -v  # Verbose to see response headers
```

**Solutions:**
- ✅ Restart backend: `npm run start:dev`
- ✅ Clear browser cache & cookies
- ✅ Check `.env.development` has `CORS_ORIGIN=http://localhost:3000`
- ✅ Check backend logs for errors

### Issue 2: Cookies Set But Not Sent on Next Request
**Symptoms**: Cookies visible in DevTools, but 401 on `/me`

**Debug:**
- Open Network tab → Click `/auth/me` request
- Check request headers for `Cookie` field
- If missing: frontend not sending `credentials: 'include'`

**Solutions:**
- ✅ Add `credentials: 'include'` to all fetch/axios calls
- ✅ Ensure `withCredentials: true` for axios
- ✅ Check CORS_ORIGIN matches frontend URL exactly

### Issue 3: CORS Error on Login
**Symptoms**: Preflight 429/403, login POST fails

**Debug:**
```bash
# Check CORS headers
curl -X OPTIONS http://localhost:4000/api/auth/login \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

**Solutions:**
- ✅ Verify `.env.development`: `CORS_ORIGIN=http://localhost:3000`
- ✅ Check backend has `credentials: true`:
  ```typescript
  app.enableCors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,  // ✅ Must be true
  });
  ```
- ✅ Frontend should send Origin header (browser automatic)

---

## Environment Variables Checklist

### Backend `.env.development`
```
CORS_ORIGIN=http://localhost:3000          # ✅ Frontend URL
NODE_ENV=development                        # ✅ Enables lax settings
JWT_SECRET=<your-secret>                    # ✅ Not empty
JWT_REFRESH_SECRET=<your-secret>            # ✅ Not empty
JWT_ACCESS_EXPIRES_IN=15m                   # ✅ Reasonable TTL
JWT_REFRESH_EXPIRES_IN=7d                   # ✅ Reasonable TTL
```

### Frontend `.env` (if applicable)
```
REACT_APP_API_URL=http://localhost:4000/api
REACT_APP_CREDENTIALS=include
```

---

## Production Deployment Checklist

When deploying to production:

- ✅ Set `NODE_ENV=production`
- ✅ Update `CORS_ORIGIN` to your frontend domain
- ✅ Use HTTPS (sets `secure: true` automatically)
- ✅ Update `sameSite: 'strict'` (for production security)
- ✅ Rotate `JWT_SECRET` and `JWT_REFRESH_SECRET`
- ✅ Use strong `MASTER_ENCRYPTION_KEY`
- ✅ Test cookies work in production domain
- ✅ Consider SameSite=Lax for better compatibility if needed

---

## Backend Cookie Settings Reference

| Setting | Development | Production | Purpose |
|---------|-------------|------------|---------|
| `httpOnly` | `true` | `true` | Prevents JavaScript access |
| `secure` | `false` (localhost) | `true` | Requires HTTPS in production |
| `sameSite` | `'none'` | `'strict'` | Cross-origin protection |
| `maxAge` | 15 min (access) | 15 min (access) | Token expiration |
| `path` (refresh) | `/api/auth/refresh` | `/api/auth/refresh` | Limits cookie scope |

---

## Files Modified

1. `/src/modules/auth/auth.controller.ts`
   - ✅ Fixed `setTokenCookies()` with proper sameSite/secure logic
   - ✅ Added tokens to response body

---

## Next Steps

1. **Verify backend changes**: `npm run start:dev`
2. **Update frontend** to send `credentials: 'include'`
3. **Test login** and check DevTools Cookies tab
4. **Test /me endpoint** to verify authentication works
5. **Check Network tab** to ensure cookies are sent

If issues persist, run the debug commands above and share logs.


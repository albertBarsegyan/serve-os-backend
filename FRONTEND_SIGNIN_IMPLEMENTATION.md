# Frontend Sign-In Implementation Quick Reference

## 🔴 The Problem

Your backend was using `sameSite: 'lax'` cookies which **blocks cross-origin cookie sharing**. Since frontend is on `http://localhost:3000` and backend on `http://localhost:4000`, they're cross-origin.

## ✅ The Backend Fix

Backend now:
- ✅ Uses `sameSite: 'none'` in development (allows cross-origin)
- ✅ Uses `sameSite: 'strict'` in production (security)
- ✅ Returns tokens in response body as backup

## 🚀 What Frontend Must Do

**Every API call must include**: `credentials: 'include'`

### Copy-Paste Solutions

#### 1️⃣ **Fetch API** (Vanilla JavaScript)
```javascript
// ✅ Login
const response = await fetch('http://localhost:4000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // 🔑 THIS LINE IS CRITICAL
  body: JSON.stringify({ email, password }),
});
const data = await response.json();
console.log(data.user); // User info
console.log(data.tokens); // Backup tokens if needed

// ✅ Get Current User
const meResponse = await fetch('http://localhost:4000/api/auth/me', {
  credentials: 'include',  // 🔑 THIS LINE IS CRITICAL
});
const currentUser = await meResponse.json();

// ✅ Logout
const logoutResponse = await fetch('http://localhost:4000/api/auth/logout', {
  method: 'POST',
  credentials: 'include',  // 🔑 THIS LINE IS CRITICAL
});
```

#### 2️⃣ **Axios** (Recommended)
```javascript
import axios from 'axios';

// Configure once
const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true,  // 🔑 THIS LINE HANDLES ALL REQUESTS
});

// ✅ Now all requests automatically include credentials
const response = await api.post('/auth/login', { email, password });
const meResponse = await api.get('/auth/me');
const logoutResponse = await api.post('/auth/logout');
```

#### 3️⃣ **React Query / TanStack Query**
```javascript
import { useQuery, useMutation } from '@tanstack/react-query';

// Configure query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const res = await fetch(`http://localhost:4000/api${queryKey[0]}`, {
          credentials: 'include',  // 🔑 THIS LINE IS CRITICAL
        });
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      },
    },
  },
});

// ✅ Login hook
const useLogin = () => {
  return useMutation({
    mutationFn: async ({ email, password }) => {
      const res = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',  // 🔑 THIS LINE IS CRITICAL
        body: JSON.stringify({ email, password }),
      });
      return res.json();
    },
  });
};

// ✅ Get current user
const { data: user } = useQuery(['me'], {
  queryFn: async () => {
    const res = await fetch('http://localhost:4000/api/auth/me', {
      credentials: 'include',  // 🔑 THIS LINE IS CRITICAL
    });
    return res.json();
  },
});
```

#### 4️⃣ **SWR**
```javascript
import useSWR from 'swr';

const fetcher = (url) =>
  fetch(url, { credentials: 'include' })  // 🔑 THIS LINE IS CRITICAL
    .then((r) => r.json());

// ✅ Use everywhere
const { data: user } = useSWR('/auth/me', fetcher);
```

#### 5️⃣ **Next.js API Routes** (SSR)
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      credentials: 'include',  // 🔑 Forward credentials
    });

    const data = await response.json();

    // Forward Set-Cookie headers
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      res.setHeader('Set-Cookie', setCookie);
    }

    return res.status(response.status).json(data);
  }
}

// Then in component:
const response = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
  // No credentials needed here - handled by proxy
});
```

#### 6️⃣ **Flutter / Mobile** (Token-based)
```dart
// Since cookies don't work on mobile, use tokens from response
final response = await http.post(
  Uri.parse('http://localhost:4000/api/auth/login'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({'email': email, 'password': password}),
);

final data = jsonDecode(response.body);
final accessToken = data['tokens']['accessToken'];

// Store in secure storage
await storage.write(
  key: 'access_token',
  value: accessToken,
);

// Use on subsequent requests
final meResponse = await http.get(
  Uri.parse('http://localhost:4000/api/auth/me'),
  headers: {'Authorization': 'Bearer $accessToken'},
);
```

---

## 🧪 How to Test

### Browser Debug (DevTools)
1. Open **DevTools** (F12)
2. Go to **Application** tab
3. Click **Cookies** → Filter by `localhost:4000`
4. After login, you should see:
   - ✅ `access_token` cookie
   - ✅ `refresh_token` cookie
   - ✅ SameSite: `None` (dev) or `Strict` (prod)
   - ✅ Secure: unchecked (localhost) or checked (production)

### Network Tab Debug
1. Open **Network** tab
2. Click login request
3. **Response Headers** should show:
   ```
   Set-Cookie: access_token=...
   Set-Cookie: refresh_token=...
   ```
4. Click `/auth/me` request
5. **Request Headers** should show:
   ```
   Cookie: access_token=...; refresh_token=...
   ```

### cURL Test
```bash
# Save cookies after login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -c cookies.txt

# Use cookies on next request
curl http://localhost:4000/api/auth/me -b cookies.txt

# Should return 200 OK with user info, NOT 401
```

---

## ⚠️ Common Mistakes

### ❌ WRONG - Missing credentials
```javascript
const response = await fetch('http://localhost:4000/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
  // Missing: credentials: 'include'
});
// Result: Cookies set but not sent back → 401 on next request
```

### ✅ CORRECT
```javascript
const response = await fetch('http://localhost:4000/api/auth/login', {
  method: 'POST',
  credentials: 'include',  // ✅ REQUIRED
  body: JSON.stringify({ email, password }),
});
```

---

## 📝 Response Format

### Login/Register Response
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "hasBusiness": false,
    "role": "OWNER"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### Get Me Response
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "hasBusiness": false,
  "role": "OWNER"
}
```

---

## 🔄 Authentication Flow

```
1. Frontend: POST /auth/login
   ↓
2. Backend: Sets Set-Cookie headers (access_token, refresh_token)
   ↓
3. Frontend: Browser automatically stores cookies
   ↓
4. Frontend: GET /auth/me WITH credentials: 'include'
   ↓
5. Backend: Reads access_token from cookies
   ↓
6. Backend: Returns 200 with user info
```

---

## 🆘 Troubleshooting

| Issue | Symptom | Solution |
|-------|---------|----------|
| Cookies not set | No Set-Cookie headers in response | Restart backend `npm run start:dev` |
| Cookies not sent | Get 401 on /auth/me | Add `credentials: 'include'` to requests |
| CORS error | Login POST fails preflight | Backend `CORS_ORIGIN` must match frontend URL exactly |
| Localhost vs 127.0.0.1 | Cookies work with one but not other | Consistent with domain: use either `localhost` or `127.0.0.1`, not both |

---

## 📚 References

- [MDN: Credentials in CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#credentials_mode)
- [MDN: SameSite Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [Axios withCredentials](https://axios-http.com/docs/req_config)
- [React Query Documentation](https://tanstack.com/query/latest)

---

## ✨ Summary

**Backend Fixed:** Cookie settings now work cross-origin in development

**You Must Do:** Add `credentials: 'include'` to all API requests

That's it! 🎉


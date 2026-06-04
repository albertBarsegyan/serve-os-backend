# Error Codes Quick Reference

## Login Errors (401)

```
USER_NOT_FOUND      → User email doesn't exist                      → "Email not registered"
INVALID_CREDENTIALS → Email exists but password is wrong            → "Invalid email or password"
USER_INACTIVE       → User account has been deactivated             → "Account deactivated"
```

## Staff Login Errors (401/403)

```
STAFF_NOT_FOUND     → Staff with email/ID doesn't exist             → "Invalid staff credentials"
INVALID_PASSWORD    → Staff password is incorrect                   → "Invalid password"
INVALID_PIN         → Staff PIN is incorrect                        → "Incorrect PIN"
INVALID_STAFF_AUTH  → Staff doesn't use this auth method            → Show correct auth method UI
STAFF_INACTIVE      → Staff account has been deactivated            → "Staff access denied"
```

## Token Errors (401)

```
INVALID_TOKEN       → JWT is malformed or missing                   → Redirect to login
INVALID_REFRESH     → Refresh token doesn't match stored            → Force logout
TOKEN_NOT_FOUND     → Refresh token missing from cookies            → Check cookie settings
TOKEN_EXPIRED       → JWT expiration time has passed                → Attempt refresh
```

## Authorization Errors (403)

```
OWNER_ACCESS_REQ    → Only business owners can do this              → "Owner permission required"
STAFF_ACCESS_REQ    → Only staff can do this                        → "Staff access required"
BUSINESS_ACCESS_DND → User doesn't own/work at this business        → "You don't have access"
UNAUTHORIZED        → Generic permission denied                     → "Access denied"
```

## Validation Errors (400)

```
VALIDATION_ERROR    → Request data is invalid (check fields)        → Show field-specific errors
INVALID_REQUEST     → Malformed or missing required data            → Check request body
```

## Conflict Errors (409)

```
CONFLICT            → Email/resource already exists                 → "Email already registered"
```

## Server Errors (500)

```
INTERNAL_ERROR      → Unexpected server error                       → "Something went wrong"
```

---

## Usage Pattern

```typescript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  credentials: 'include',  // IMPORTANT!
  body: JSON.stringify({ email, password })
});

if (!response.ok) {
  const error = await response.json();
  
  // Use errorCode in your logic
  switch (error.errorCode) {
    case 'USER_NOT_FOUND':
      showError('Email not registered. Please sign up first.');
      break;
    case 'INVALID_CREDENTIALS':
      showError('Invalid email or password.');
      break;
    // ... etc
  }
  
  // Include requestId in logs/errors for debugging
  console.error(`Login failed [${error.requestId}]:`, error.message);
}
```

---

## Response Structure

```json
{
  "statusCode": 401,
  "timestamp": "2026-06-01T15:24:13.582Z",
  "path": "/api/auth/login",
  "message": "User not found",
  "requestId": "0e2615b4-8011-4f7e-90b3-989727fc785a",
  "errorCode": "USER_NOT_FOUND"
}
```

- **statusCode**: HTTP status (400, 401, 403, 409, 500, etc.)
- **timestamp**: When error occurred (ISO 8601)
- **path**: Which endpoint failed
- **message**: Human-readable error message
- **requestId**: Unique ID for tracking/support tickets
- **errorCode**: Machine-readable code for your logic

---

## Key Points

1. ✅ Always use `errorCode` for logic, not `message`
2. ✅ Always include `credentials: 'include'` in fetch/axios
3. ✅ Display `requestId` to user for support: "Error ID: abc123"
4. ✅ Log `errorCode` for debugging/analytics
5. ✅ Handle network errors separately (no errorCode)

---

## Testing

```bash
# USER_NOT_FOUND
curl -X POST http://localhost:4000/api/auth/login \
  -d '{"email":"unused@example.com","password":"test"}' \
  -H 'Content-Type: application/json'

# INVALID_CREDENTIALS
curl -X POST http://localhost:4000/api/auth/login \
  -d '{"email":"existing@example.com","password":"wrong"}' \
  -H 'Content-Type: application/json'

# INVALID_TOKEN
curl http://localhost:4000/api/auth/me \
  -H 'Authorization: Bearer invalid'
```


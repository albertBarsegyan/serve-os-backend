# Error Handling & Response Structure

## Overview
This document describes the standardized error response format used across the Serve-OS API, and how the frontend should handle different error codes.

---

## Error Response Format

All error responses follow this consistent structure:

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

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `statusCode` | number | HTTP status code (400, 401, 403, 404, 409, 500, etc.) |
| `timestamp` | string | ISO 8601 timestamp when the error occurred |
| `path` | string | API endpoint path where error occurred |
| `message` | string | Human-readable error message |
| `requestId` | string | Unique request ID for correlation/debugging (useful for support tickets) |
| `errorCode` | string | Machine-readable error code for fine-grained frontend handling |
| `errors` | object[] | (Optional) Array of validation errors with field names |

---

## Error Codes

The `errorCode` field can be one of the following values, allowing frontend to provide specific handling:

### Authentication Errors (401 Unauthorized)

| Code | Message | Meaning | Frontend Action |
|------|---------|---------|-----------------|
| `USER_NOT_FOUND` | User not found | Email doesn't exist in system | Show "Email not registered" or "Sign up first" |
| `INVALID_CREDENTIALS` | Invalid credentials | Email exists but password is wrong | Show "Invalid email or password" (generic for security) |
| `USER_INACTIVE` | User account is inactive | Account has been disabled | Show "Account has been deactivated" |
| `INVALID_TOKEN` | Invalid or missing token | JWT is malformed or missing | Redirect to login, clear stored tokens |
| `TOKEN_EXPIRED` | Token has expired | JWT is expired | Attempt refresh; if that fails, redirect to login |
| `INVALID_REFRESH_TOKEN` | Invalid or expired refresh token | Refresh token doesn't match stored | Redirect to login, clear all cookies |
| `TOKEN_NOT_FOUND` | Refresh token not found in cookies | Refresh endpoint requires cookie | Check client is sending cookies with requests |

### Staff/Employee Errors (401/403)

| Code | Message | Meaning | Frontend Action |
|------|---------|---------|-----------------|
| `STAFF_NOT_FOUND` | Staff member not found with this email | Email/PIN not registered | Show "Invalid staff credentials" |
| `STAFF_INACTIVE` | Staff member not found or is inactive | Staff account disabled | Show "Staff access denied" |
| `INVALID_PASSWORD` | Invalid password | Password is incorrect | Show "Invalid staff credentials" |
| `INVALID_PIN` | Invalid PIN | PIN is incorrect | Show "Invalid PIN, try again" |
| `INVALID_STAFF_AUTH_METHOD` | Invalid login method for this staff | Staff doesn't use this auth type (password vs PIN) | Show appropriate auth method UI |

### Authorization Errors (403 Forbidden)

| Code | Message | Meaning | Frontend Action |
|------|---------|---------|-----------------|
| `OWNER_ACCESS_REQUIRED` | Owner access required | Only business owners can do this | Show "Owner permission required" |
| `STAFF_ACCESS_REQUIRED` | Staff access required | Only staff can do this | Show "Staff access required" |
| `BUSINESS_ACCESS_DENIED` | You do not have access to this business | User doesn't own/work at this business | Show "You don't have access to this business" |
| `UNAUTHORIZED` | Generic unauthorized error | Catch-all for permission issues | Show "Access denied" |

### Request Errors (400 Bad Request)

| Code | Message | Meaning | Frontend Action |
|------|---------|---------|-----------------|
| `VALIDATION_ERROR` | Validation failed | Request data is invalid (email format, etc.) | Show field-specific validation messages from `errors` array |
| `INVALID_REQUEST` | Invalid request | Malformed request body | Check request format matches API spec |

### Conflict Errors (409 Conflict)

| Code | Message | Meaning | Frontend Action |
|------|---------|---------|-----------------|
| `CONFLICT` | User already exists | Email already registered | Show "Email already registered, try login instead" |

### Server Errors (500 Internal Server Error)

| Code | Message | Meaning | Frontend Action |
|------|---------|---------|-----------------|
| `INTERNAL_ERROR` | Internal server error | Unexpected server error | Show generic "Something went wrong" + ask user to try again |

---

## Frontend Usage Examples

### Example 1: Login Error Handling

```typescript
// src/api/auth.ts (or similar)
async function loginUser(email: string, password: string) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include', // Important: include cookies
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json(); // Get the structured error response
      
      switch (error.errorCode) {
        case 'USER_NOT_FOUND':
          // User typed an email that doesn't exist
          showError('Email not registered. Please sign up first.');
          trackEvent('login_user_not_found', { email });
          break;
          
        case 'INVALID_CREDENTIALS':
          // Email exists but password is wrong (don't reveal which part is wrong for security)
          showError('Invalid email or password.');
          trackEvent('login_invalid_password', { email });
          break;
          
        case 'USER_INACTIVE':
          // Account was deactivated
          showError('This account has been deactivated. Contact support.');
          trackEvent('login_user_inactive', { email });
          break;
          
        default:
          showError(error.message);
          logError('Unexpected login error', error);
      }
      
      return;
    }

    const data = await response.json();
    // Success! Store user data and navigate to dashboard
    localStorage.setItem('user', JSON.stringify(data.user));
    navigateTo('/dashboard');
    
  } catch (err) {
    showError('Network error. Please try again.');
    logError('Login network error', err);
  }
}
```

### Example 2: Staff Login with PIN

```typescript
async function loginStaffWithPin(businessId: string, staffId: string, pin: string) {
  try {
    const response = await fetch(`/api/businesses/${businessId}/staff/login/pin`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId, pin })
    });

    if (!response.ok) {
      const error = await response.json();
      
      switch (error.errorCode) {
        case 'STAFF_NOT_FOUND':
          showError('Invalid staff ID or PIN.');
          break;
          
        case 'INVALID_PIN':
          showError('Incorrect PIN. Please try again.');
          resetPinInput(); // Clear the PIN field
          break;
          
        case 'STAFF_INACTIVE':
          showError('Staff access has been revoked.');
          break;
          
        default:
          showError(error.message);
      }
      
      return;
    }

    // Success
    const data = await response.json();
    stores.setAuthToken(data.accessToken);
    navigateTo('/staff-dashboard');
    
  } catch (err) {
    showError('Network error. Please try again.');
  }
}
```

### Example 3: Token Refresh Handling

```typescript
async function refreshAccessToken() {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include' // Sends refresh_token cookie
    });

    if (!response.ok) {
      const error = await response.json();
      
      switch (error.errorCode) {
        case 'INVALID_REFRESH_TOKEN':
        case 'TOKEN_NOT_FOUND':
          // Session is invalid, user needs to login again
          clearAllData();
          navigateTo('/login');
          showError('Session expired. Please log in again.');
          break;
          
        case 'USER_INACTIVE':
          clearAllData();
          showError('Account has been deactivated.');
          navigateTo('/login');
          break;
          
        default:
          logError('Token refresh failed', error);
          // Try again later?
          setTimeout(refreshAccessToken, 5000);
      }
      
      return false;
    }

    const data = await response.json();
    // Tokens were refreshed and cookies updated
    return true;
    
  } catch (err) {
    logError('Token refresh network error', err);
    return false;
  }
}
```

### Example 4: Validation Errors

```typescript
async function createBusiness(formData: any) {
  try {
    const response = await fetch('/api/business', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (!response.ok) {
      const error = await response.json();
      
      if (error.errorCode === 'VALIDATION_ERROR') {
        // Show field-specific errors
        if (error.errors) {
          error.errors.forEach(err => {
            showFieldError(err.field, err.message);
          });
        }
      } else if (error.errorCode === 'CONFLICT') {
        showError('Business name already exists.');
      } else {
        showError(error.message);
      }
      
      return;
    }

    const data = await response.json();
    navigateTo(`/business/${data.id}`);
    
  } catch (err) {
    showError('Network error. Please try again.');
  }
}
```

---

## Best Practices

1. **Always use `errorCode` for logic, not `message`**
   - Messages can change for UX improvements
   - Error codes are stable for logic

2. **Log error and request ID for support**
   - When user reports an issue, ask for the request ID
   - Search server logs with the request ID to find the exact error

3. **Handle network errors separately**
   - Network errors won't have an `errorCode`
   - Show generic "Network error. Please try again." message

4. **Include credentials in all requests**
   - Always use `credentials: 'include'` in fetch/axios
   - This ensures cookies are sent to/from the server

5. **Show generic messages for security errors**
   - Don't reveal whether email exists or if password is wrong
   - Use "Invalid email or password" instead

6. **Implement auto-retry for token refresh**
   - If refresh fails with `INVALID_REFRESH_TOKEN`, force logout
   - If refresh fails with network error, retry in a few seconds

---

## Testing Error Codes

To test different error scenarios:

### Test USER_NOT_FOUND
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"nonexistent@example.com","password":"password123"}'
```
Response will include `"errorCode": "USER_NOT_FOUND"`

### Test INVALID_CREDENTIALS
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"existing@example.com","password":"wrongpassword"}'
```
Response will include `"errorCode": "INVALID_CREDENTIALS"`

### Test INVALID_TOKEN
```bash
curl -X GET http://localhost:4000/api/auth/me \
  -H 'Authorization: Bearer invalid.token.here'
```
Response will include `"errorCode": "INVALID_TOKEN" and statusCode 401`

---

## Changelog

### v1.0.0 (2026-06-01)
- Initial structured error response format
- Added `errorCode` field for fine-grained frontend handling
- Added `requestId` field for request tracking


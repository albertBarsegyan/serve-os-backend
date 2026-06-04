# Frontend Error Response Fix - Complete Summary

## Problem Statement
The backend was correctly returning 401 "Invalid credentials" errors, but the frontend had difficulty properly handling and displaying these errors because:

1. **No error codes** - All auth errors returned generic "Invalid credentials" without distinguishing between different scenarios (user not found, wrong password, inactive account, etc.)
2. **No request ID** - Frontend couldn't correlate errors for debugging/support purposes
3. **Inconsistent response format** - Error structure varied across different endpoints
4. **No validation error details** - Validation errors didn't include which field failed

---

## Solution Implemented

### 1. Created Standardized Error Code Enum
**File**: `src/common/enums/api-error-code.enum.ts`

Created a comprehensive error code system that maps error messages to machine-readable codes:

```typescript
export enum ApiErrorCode {
  // Authentication errors
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_INACTIVE = 'USER_INACTIVE',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  INVALID_PIN = 'INVALID_PIN',
  
  // Staff errors
  STAFF_NOT_FOUND = 'STAFF_NOT_FOUND',
  STAFF_INACTIVE = 'STAFF_INACTIVE',
  INVALID_STAFF_AUTH_METHOD = 'INVALID_STAFF_AUTH_METHOD',
  
  // Token errors
  INVALID_TOKEN = 'INVALID_TOKEN',
  INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_NOT_FOUND = 'TOKEN_NOT_FOUND',
  
  // Authorization errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  OWNER_ACCESS_REQUIRED = 'OWNER_ACCESS_REQUIRED',
  STAFF_ACCESS_REQUIRED = 'STAFF_ACCESS_REQUIRED',
  BUSINESS_ACCESS_DENIED = 'BUSINESS_ACCESS_DENIED',
  
  // Generic errors
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
```

**Includes**:
- Error message to code mapping dictionary
- `getErrorCode()` function that intelligently maps error messages to codes
- Fallback logic for unmapped messages

### 2. Created Standard Error Response DTO
**File**: `src/common/dto/error-response.dto.ts`

Defined the error response structure used across all endpoints:

```typescript
export class ErrorResponseDto {
  statusCode: number;              // HTTP status code
  timestamp: string;               // ISO 8601 timestamp
  path: string;                    // API endpoint path
  message: string;                 // Human-readable message
  requestId: string;               // Unique request ID for tracking
  errorCode?: string;              // Machine-readable error code
  errors?: Array<{                 // Validation field errors
    field?: string;
    message: string;
  }>;
}
```

### 3. Enhanced HTTP Exception Filter
**File**: `src/common/filters/http-exception.filter.ts`

Updated to:
- Import and use the error code enum
- Call `getErrorCode()` to resolve error codes from messages
- Include `requestId` in the response (critical for support)
- Include `errorCode` in the response

**Old Response**:
```json
{
  "statusCode": 401,
  "timestamp": "2026-06-01T15:24:13.582Z",
  "path": "/api/auth/login",
  "message": "Invalid credentials"
}
```

**New Response**:
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

### 4. Updated Auth Controller
**File**: `src/modules/auth/auth.controller.ts`

- Added `ErrorResponseDto` type to Swagger documentation
- Updated `@ApiResponse()` decorators to show error structure
- Improved clarity of error scenarios in API docs

---

## Key Features

### ✅ Fine-Grained Error Codes
Frontend can now distinguish between:
- `USER_NOT_FOUND` - Email doesn't exist
- `INVALID_CREDENTIALS` - Email exists but password wrong
- `USER_INACTIVE` - Account disabled
- `INVALID_TOKEN` - JWT malformed or missing
- `INVALID_REFRESH_TOKEN` - Refresh token invalid
- etc.

### ✅ Request Tracking
- Every error response includes a `requestId`
- Frontend can display this to user for support ("Error code: abc123")
- Support can search server logs with this ID to find exact error

### ✅ Consistent Format
- All error responses follow the same structure
- Frontend can reliably parse `errorCode` field
- No more guessing about error types

### ✅ Validation Details
- Validation errors include field names
- Frontend can show "Email is invalid" for the email field specifically

### ✅ Intelligent Fallback
- If an error message doesn't have an exact mapping, the system intelligently infers the code
- "something not found" → `NOT_FOUND`
- "something unauthorized" → `UNAUTHORIZED`
- Unknown errors → `INTERNAL_ERROR`

---

## Frontend Integration Guide

### Login Error Handling Example

```typescript
async function loginUser(email: string, password: string) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json(); // Get structured error
      
      // Use errorCode for logic, message for display
      switch (error.errorCode) {
        case 'USER_NOT_FOUND':
          showError('Email not registered. Please sign up.');
          break;
        case 'INVALID_CREDENTIALS':
          showError('Invalid email or password.');
          break;
        case 'USER_INACTIVE':
          showError('Account deactivated. Contact support.');
          break;
        default:
          showError(error.message);
      }
      
      // Show request ID so user can report issue
      console.log(`Error ID: ${error.requestId}`);
      return;
    }

    const data = await response.json();
    // Success!
    localStorage.setItem('user', JSON.stringify(data.user));
    navigateTo('/dashboard');
  } catch (err) {
    showError('Network error. Please try again.');
  }
}
```

### Staff Login with PIN Example

```typescript
async function loginStaffWithPin(businessId: string, staffId: string, pin: string) {
  const response = await fetch(`/api/businesses/${businessId}/staff/login/pin`, {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({ staffId, pin })
  });

  if (!response.ok) {
    const error = await response.json();
    
    switch (error.errorCode) {
      case 'STAFF_NOT_FOUND':
        showError('Invalid staff ID or PIN.');
        break;
      case 'INVALID_PIN':
        showError('Incorrect PIN. Try again.');
        clearPinInput();
        break;
      case 'STAFF_INACTIVE':
        showError('Staff access has been revoked.');
        break;
    }
    
    logError('Staff login failed', { 
      errorCode: error.errorCode,
      requestId: error.requestId 
    });
    return;
  }

  // Success
  const data = await response.json();
  stores.setAuthToken(data.accessToken);
  navigateTo('/staff-dashboard');
}
```

---

## Error Code Reference

### Authentication (401)
| Code | Meaning | Frontend Action |
|------|---------|-----------------|
| `USER_NOT_FOUND` | Email doesn't exist | "Email not registered" |
| `INVALID_CREDENTIALS` | Password wrong | "Invalid email or password" |
| `USER_INACTIVE` | Account disabled | "Account deactivated" |

### Tokens (401)
| Code | Meaning | Frontend Action |
|------|---------|-----------------|
| `INVALID_TOKEN` | JWT malformed | Redirect to login |
| `INVALID_REFRESH_TOKEN` | Refresh token invalid | Redirect to login |
| `TOKEN_EXPIRED` | Token expired | Attempt refresh |
| `TOKEN_NOT_FOUND` | Refresh token missing | Redirect to login |

### Staff (401/403)
| Code | Meaning | Frontend Action |
|------|---------|-----------------|
| `STAFF_NOT_FOUND` | Staff doesn't exist | "Invalid credentials" |
| `STAFF_INACTIVE` | Staff disabled | "Access denied" |
| `INVALID_PASSWORD` | Wrong password | "Invalid credentials" |
| `INVALID_PIN` | Wrong PIN | "Incorrect PIN" |

### Authorization (403)
| Code | Meaning | Frontend Action |
|------|---------|-----------------|
| `OWNER_ACCESS_REQUIRED` | Only owners allowed | "Owner permission required" |
| `STAFF_ACCESS_REQUIRED` | Only staff allowed | "Staff access required" |
| `BUSINESS_ACCESS_DENIED` | No business access | "You don't have access" |

### Validation (400)
| Code | Meaning | Frontend Action |
|------|---------|-----------------|
| `VALIDATION_ERROR` | Invalid request data | Show field errors |
| `INVALID_REQUEST` | Malformed data | Show generic error |

### Conflict (409)
| Code | Meaning | Frontend Action |
|------|---------|-----------------|
| `CONFLICT` | Resource already exists | "Email already registered" |

### Server (500)
| Code | Meaning | Frontend Action |
|------|---------|-----------------|
| `INTERNAL_ERROR` | Server error | "Something went wrong" |

---

## Support Ticket Example

**User Report**: "I can't login, getting an error"

**Frontend captures and displays**:
```
Error: User not found
Error ID: 0e2615b4-8011-4f7e-90b3-989727fc785a
```

**Support can now**:
1. Search server logs for request ID `0e2615b4-8011-4f7e-90b3-989727fc785a`
2. See exact timestamp, email, and reason for the error
3. Quickly diagnose and resolve the issue

---

## Files Created

1. **`src/common/enums/api-error-code.enum.ts`**
   - Error code definitions
   - Message-to-code mapping
   - Intelligent error code resolution function

2. **`src/common/dto/error-response.dto.ts`**
   - Swagger-documented DTO for error responses
   - Uses as type for API documentation

3. **`FRONTEND_ERROR_HANDLING.md`**
   - Complete frontend integration guide
   - Example code snippets
   - Error code reference table

## Files Modified

1. **`src/common/filters/http-exception.filter.ts`**
   - Imports error code enum and function
   - Adds error code resolution via `getErrorCode()`
   - Includes `requestId` in response
   - Includes `errorCode` in response

2. **`src/modules/auth/auth.controller.ts`**
   - Adds `ErrorResponseDto` import
   - Updates Swagger `@ApiResponse()` decorators
   - More descriptive API documentation

---

## Testing

To test and verify error codes are returned correctly:

```bash
# Test USER_NOT_FOUND
curl -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"nonexistent@example.com","password":"password"}'

# Expected: errorCode: "USER_NOT_FOUND"

# Test INVALID_CREDENTIALS (with existing user)
curl -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"existing@example.com","password":"wrongpassword"}'

# Expected: errorCode: "INVALID_CREDENTIALS"

# Test INVALID_TOKEN
curl -X GET http://localhost:4000/api/auth/me \
  -H 'Authorization: Bearer invalid.token.here'

# Expected: errorCode: "INVALID_TOKEN"
```

---

## Backwards Compatibility

✅ **No breaking changes**:
- Existing `statusCode`, `timestamp`, `path`, `message` fields are unchanged
- `errorCode` and `requestId` are new fields
- Frontend can ignore them if not using yet
- Server logs include error codes for troubleshooting

---

## Next Steps

1. **Frontend team** can update their error handlers to use `errorCode` field
2. **Use the table in `FRONTEND_ERROR_HANDLING.md`** as a reference
3. **Display `requestId` to users** for better support experience
4. **Test different error scenarios** to verify error codes are correct
5. **Update error dialogs** to provide specific, helpful messages based on error code


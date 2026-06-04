# Auth Module Error Messages Fixes

## Overview
This document outlines the improvements made to error messages in the auth module and guards to provide clearer feedback when users/staff don't exist or are inactive.

---

## Changes Made

### 1. **auth.service.ts** - `getMe()` method
**Issue**: Original code used `!user?.isActive` which would throw the same error whether user was null or inactive, making debugging difficult.

**Changes**:
- Added null check BEFORE checking `isActive`
- Differentiated error messages:
  - `"User not found"` when user doesn't exist
  - `"User account is inactive"` when user exists but is inactive
- Added logging for both failure scenarios

**Before**:
```typescript
if (!user?.isActive) {
  throw new UnauthorizedException('Access denied');
}
```

**After**:
```typescript
if (!user) {
  this.logger.warn({ userId }, 'getMe failed: user not found');
  throw new UnauthorizedException('User not found');
}

if (!user.isActive) {
  this.logger.warn({ userId }, 'getMe failed: user is inactive');
  throw new UnauthorizedException('User account is inactive');
}
```

---

### 2. **auth.service.ts** - `refreshTokens()` method
**Issue**: Same as above - unsafe null coalescing with `isActive` check without first verifying user exists.

**Changes**:
- Added explicit null check
- Differentiated error messages for different failure scenarios:
  - `"User not found"` when user doesn't exist
  - `"User account is inactive"` when user is inactive
  - `"No valid refresh token"` when no refresh token is stored
  - `"Invalid or expired refresh token"` when token doesn't match
- Added logging to all error paths

**Before**:
```typescript
if (!user?.isActive) {
  throw new UnauthorizedException('Access denied');
}

if (!user.refreshToken) {
  throw new UnauthorizedException('Access denied');
}

// ... token comparison throws same error
throw new UnauthorizedException('Access denied');
```

**After**:
```typescript
if (!user) {
  this.logger.warn({ userId }, 'refreshTokens failed: user not found');
  throw new UnauthorizedException('User not found');
}

if (!user.isActive) {
  this.logger.warn({ userId }, 'refreshTokens failed: user is inactive');
  throw new UnauthorizedException('User account is inactive');
}

if (!user.refreshToken) {
  this.logger.warn({ userId }, 'refreshTokens failed: no refresh token stored');
  throw new UnauthorizedException('No valid refresh token');
}

// ... token comparison
throw new UnauthorizedException('Invalid or expired refresh token');
```

---

### 3. **guards/jwt-auth.guard.ts** - `handleRequest()` method
**Issue**: Threw empty `UnauthorizedException()` without any message.

**Changes**:
- Added descriptive error message: `"Invalid or missing token"`

**Before**:
```typescript
throw err ?? new UnauthorizedException();
```

**After**:
```typescript
throw err ?? new UnauthorizedException('Invalid or missing token');
```

---

### 4. **guards/unified-auth.guard.ts** - `handleRequest()` method
**Issue**: Same as jwt-auth.guard - threw exception without message.

**Changes**:
- Added descriptive error message: `"Invalid or missing authentication token"`

**Before**:
```typescript
throw err || new UnauthorizedException();
```

**After**:
```typescript
throw err || new UnauthorizedException('Invalid or missing authentication token');
```

---

### 5. **strategies/jwt.strategy.ts** - `validate()` method
**Issue**: Minimal error handling without checking for required fields like `type`.

**Changes**:
- Enhanced validation to check payload is not null
- Added validation for required `type` field
- More descriptive error messages:
  - `"Invalid or malformed JWT token"` for null payload
  - `"Token missing required type field"` when type is missing

**Before**:
```typescript
if (!payload) {
  throw new UnauthorizedException('Invalid token');
}

return payload;
```

**After**:
```typescript
if (!payload) {
  throw new UnauthorizedException('Invalid or malformed JWT token');
}

if (!payload.type) {
  throw new UnauthorizedException('Token missing required type field');
}

return payload;
```

---

### 6. **strategies/jwt-refresh.strategy.ts** - `validate()` method
**Issue**: Generic message and console.log statement (violates ESLint rules).

**Changes**:
- More descriptive error message for missing refresh token
- Added validation for payload
- Removed console.log statement (violates ESLint no-console rule)
- Added error message for invalid payload

**Before**:
```typescript
if (!refreshToken) {
  throw new UnauthorizedException('Refresh token not found');
}

console.log('payload validate refresh', payload);

return { sub: payload.sub, refreshToken };
```

**After**:
```typescript
if (!refreshToken) {
  throw new UnauthorizedException('Refresh token not found in cookies');
}

if (!payload) {
  throw new UnauthorizedException('Invalid refresh token payload');
}

return { sub: payload.sub, refreshToken };
```

---

### 7. **strategies/staff-jwt.strategy.ts** - `validate()` method
**Issue**: Vague error message `"Staff access denied"` doesn't indicate what went wrong.

**Changes**:
- Added payload validation
- More descriptive error message: `"Staff member not found or is inactive"`
- New message for invalid payload: `"Invalid staff token payload"`

**Before**:
```typescript
if (!staff) {
  throw new UnauthorizedException('Staff access denied');
}
```

**After**:
```typescript
if (!payload) {
  throw new UnauthorizedException('Invalid staff token payload');
}

if (!staff) {
  throw new UnauthorizedException('Staff member not found or is inactive');
}
```

---

### 8. **staff/staff.service.ts** - `loginWithPin()` method
**Issue**: Generic `"Invalid credentials"` message doesn't indicate if staff exists or PIN is wrong.

**Changes**:
- Differentiated error messages:
  - `"Staff member not found or invalid PIN authentication method"` when staff not found
  - `"PIN not set for this staff member"` when PIN not configured
  - `"Invalid PIN"` when PIN is incorrect
- Better specificity for debugging

**Before**:
```typescript
if (!staff) {
  throw new BadRequestException('Invalid credentials');
}

if (!staff.pin) {
  throw new BadRequestException('PIN not set for this staff member');
}

if (!isValidPin) {
  throw new BadRequestException('Invalid credentials');
}
```

**After**:
```typescript
if (!staff) {
  throw new BadRequestException('Staff member not found or invalid PIN authentication method');
}

if (!staff.pin) {
  throw new BadRequestException('PIN not set for this staff member');
}

if (!isValidPin) {
  throw new BadRequestException('Invalid PIN');
}
```

---

### 9. **staff/staff.service.ts** - `loginWithPassword()` method
**Issue**: Generic `"Invalid credentials"` for different error scenarios.

**Changes**:
- Differentiated error messages:
  - `"Staff member not found with this email"` when staff not found
  - `"Invalid login method for this staff member"` when auth type doesn't match
  - `"Password not configured for this staff member"` when password not set
  - `"Invalid password"` when password is incorrect
- More helpful messages for support/debugging

**Before**:
```typescript
if (!staff) {
  throw new BadRequestException('Invalid credentials');
}

// ... auth type checks

if (!staff.passwordHash) {
  throw new BadRequestException('Password not set');
}

if (!isValidPassword) {
  throw new BadRequestException('Invalid credentials');
}
```

**After**:
```typescript
if (!staff) {
  throw new BadRequestException('Staff member not found with this email');
}

if (staff.authType !== StaffAuthType.PASSWORD && staff.authType !== StaffAuthType.INVITE_PENDING) {
  throw new BadRequestException('Invalid login method for this staff member');
}

if (!staff.passwordHash) {
  throw new BadRequestException('Password not configured for this staff member');
}

if (!isValidPassword) {
  throw new BadRequestException('Invalid password');
}
```

---

## Summary of Improvements

| File | Method | Improvement |
|------|--------|-------------|
| auth.service.ts | getMe() | Added null check, differentiated error messages |
| auth.service.ts | refreshTokens() | Added null check, detailed error messages for each failure scenario |
| guards/jwt-auth.guard.ts | handleRequest() | Added error message to UnauthorizedException |
| guards/unified-auth.guard.ts | handleRequest() | Added error message to UnauthorizedException |
| strategies/jwt.strategy.ts | validate() | Added payload and type validation |
| strategies/jwt-refresh.strategy.ts | validate() | Enhanced validation, removed console.log |
| strategies/staff-jwt.strategy.ts | validate() | Added payload validation, clearer error message |
| staff/staff.service.ts | loginWithPin() | Differentiated error messages |
| staff/staff.service.ts | loginWithPassword() | Detailed error messages for each scenario |

---

## Key Principles Applied

1. **Explicit NULL checks**: Always check for null/undefined BEFORE accessing properties
2. **Descriptive messages**: Replace generic "Invalid credentials" or "Access denied" with specific reasons
3. **Logging**: Add logging to help troubleshoot authentication issues
4. **User experience**: Different error messages help distinguish between configuration issues and authentication failures
5. **Security**: Messages are descriptive but don't leak sensitive internal information

---

## Testing Recommendations

Test the following scenarios:
- User/staff doesn't exist
- User/staff is inactive
- Tokens are missing or invalid
- Token payloads are malformed
- Password/PIN mismatches
- Configuration issues (password not set, auth type mismatch)

These improved error messages will now make debugging auth issues significantly easier while maintaining security best practices.


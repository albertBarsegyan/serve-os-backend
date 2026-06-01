# NestJS Authentication Refactoring - Completion Summary

## Overview
The authentication system has been successfully refactored to support two distinct principal types: **owners** (users) and **staff**. This refactoring implements a discriminated union pattern using TypeScript types to ensure type-safe authentication across the application.

## Files Created

### 1. **src/modules/auth/types/auth-payload.type.ts** (NEW)
Defines the discriminated union types for authentication payloads:
- `OwnerPayload`: Contains `type: 'owner'`, `userId`, and `email`
- `StaffPayload`: Contains `type: 'staff'`, `staffId`, `businessId`, and `role`
- `AuthPayload`: Union type that can be either OwnerPayload or StaffPayload

### 2. **src/modules/auth/guards/unified-auth.guard.ts** (NEW)
- Extends `AuthGuard('jwt')`
- Validates JWT and returns the raw `AuthPayload` object
- Attaches typed fields to the request based on principal type:
  - For owners: `req.ownerId` and `req.userEmail`
  - For staff: `req.staffId`, `req.businessId`, and `req.staffRole`
  - Always: `req.authPayload` (the full validated payload)

### 3. **src/modules/auth/guards/owner-only.guard.ts** (NEW)
- Extends `UnifiedAuthGuard`
- Checks `payload.type === 'owner'`
- Throws `ForbiddenException` if not an owner

### 4. **src/modules/auth/guards/staff-only.guard.ts** (NEW)
- Extends `UnifiedAuthGuard`
- Checks `payload.type === 'staff'`
- Throws `ForbiddenException` if not staff

### 5. **src/modules/auth/decorators/auth-payload.decorator.ts** (NEW)
- Custom param decorator `@GetAuthPayload()`
- Returns the validated `AuthPayload` from `request.user`
- Type-safe alternative to `@AuthUser()` for the new auth system

## Files Modified

### 1. **src/modules/auth/strategies/jwt.strategy.ts**
**Changes:**
- Removed User repository and related lookups
- Updated `validate()` method to return the raw `AuthPayload` directly from the JWT token
- Method signature: `validate(payload: AuthPayload): AuthPayload`
- Simplified to return payload as-is without transformation
- Cleaned up unused imports

### 2. **src/modules/auth/auth.service.ts**
**Changes:**
- Added imports for `Staff` entity and auth payload types
- Updated `generateTokens()` to work with generic `AuthPayload`
- Added `generateTokensForOwner()` specifically for owner login flows
- Added `loginOwner()` method that returns JWT with `OwnerPayload`
- Added `loginStaff()` method that returns JWT with `StaffPayload`
- Existing `login()` and `register()` methods continue to work with the updated token generation

### 3. **src/modules/auth/auth.controller.ts**
**Changes:**
- Replaced `JwtAuthGuard` with `UnifiedAuthGuard` for authenticated endpoints
- Updated `@AuthUser()` decorators to `@GetAuthPayload()` where needed
- Updated `logout()` to extract userId based on payload type
- Updated `selectBusiness()` to pass `AuthPayload` to business service
- Updated `clearBusiness()` guard from `JwtAuthGuard` to `UnifiedAuthGuard`
- Backward compatible with existing endpoints

### 4. **src/modules/auth/auth.module.ts**
**Changes:**
- Added providers: `UnifiedAuthGuard`, `OwnerOnlyGuard`, `StaffOnlyGuard`
- Exported new guards for use in other modules

### 5. **src/modules/business/business.service.ts**
**Changes:**
- Updated `findAll(payload: AuthPayload)` to branch on payload type:
  - Owners see only their own businesses (`ownerId`)
  - Staff see only their assigned business (`businessId`)
- Updated `findOne(id: string, payload: AuthPayload)` to:
  - Fetch business by ID
  - Verify access based on payload type (owner vs staff)
  - Throw `ForbiddenException` if access denied
- Updated `update()` and `remove()` methods to accept `AuthPayload`
  - Only owners can update/delete businesses
  - Both methods throw `ForbiddenException` for non-owners

### 6. **src/modules/business/business.controller.ts**
**Changes:**
- Added `@UseGuards(UnifiedAuthGuard)` to authenticated endpoints
- Updated all method signatures to use `@GetAuthPayload()` decorator
- Updated `create()` to construct a temporary `AuthenticatedUser` from `AuthPayload` (for backward compatibility)
- Updated `findAll()`, `findOne()`, `update()`, `remove()` to pass `AuthPayload` to service
- Maintained `@Roles()` decorators for legacy role-based access control

## Key Design Decisions

1. **Discriminated Union Types**: The `AuthPayload` type uses TypeScript's discriminated union pattern with a `type` field, ensuring exhaustive type checking with `if (payload.type === 'owner')` and `if (payload.type === 'staff')` patterns.

2. **No User Entity Lookups in JWT Strategy**: The JWT strategy now trusts the JWT contents directly, eliminating database lookups during token validation. This improves performance and reduces coupling.

3. **Request Object Enhancement**: The `UnifiedAuthGuard` attaches typed fields to the request object for convenient access to auth context throughout the request lifecycle.

4. **Backward Compatibility**: The existing `JwtAuthGuard` remains unchanged and continues to work as the default APP_GUARD with the `@Public()` decorator. Both auth systems can coexist.

5. **Type Safety**: All imports of `AuthPayload` in decorated signatures use `import type` to comply with TypeScript's `isolatedModules` and `emitDecoratorMetadata` requirements.

## Method Signature Changes Summary

| Method | Before | After |
|--------|--------|-------|
| `businessService.findAll()` | `findAll(userId: string)` | `findAll(payload: AuthPayload)` |
| `businessService.findOne()` | `findOne(id: string, userId: string)` | `findOne(id: string, payload: AuthPayload)` |
| `businessService.update()` | `update(id: string, userId: string, ...)` | `update(id: string, payload: AuthPayload, ...)` |
| `businessService.remove()` | `remove(id: string, userId: string)` | `remove(id: string, payload: AuthPayload)` |
| `authService.loginOwner()` | N/A (new) | `loginOwner(user: User)` |
| `authService.loginStaff()` | N/A (new) | `loginStaff(staff: Staff)` |

## Authorization Rules

### Business Access
- **Owners**: See all their owned businesses
- **Staff**: See only their assigned business (the one they're staff for)

### Business Modification
- **Owners**: Can update/delete their own businesses
- **Staff**: Cannot update/delete any business (ForbiddenException)

## Testing Recommendations

1. Test owner login and JWT payload structure
2. Test staff login and JWT payload structure
3. Verify owner access to their businesses
4. Verify owner cannot access other owners' businesses
5. Verify staff can only access their assigned business
6. Verify staff cannot update/delete businesses
7. Test guard behavior with invalid tokens
8. Test backward compatibility with legacy endpoints

## Migration Path for Existing Code

If you have other services or controllers using `authService` or `businessService`:
1. Update method calls to pass `AuthPayload` instead of `userId`
2. Use `@GetAuthPayload()` instead of `@AuthUser()` to get the payload
3. Use `if (payload.type === 'owner')` vs `if (payload.type === 'staff')` to branch logic
4. Optionally use `@OwnerOnlyGuard()` or `@StaffOnlyGuard()` for method-level access control



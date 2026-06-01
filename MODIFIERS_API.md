# Modifier Groups API Documentation

This document describes the API endpoints for managing business modifier groups and their modifier items.

## Base URL

```
/businesses/:businessId/modifier-groups
```

All endpoints require authentication via `UnifiedAuthGuard` and tenant authorization via `TenantGuard`.

---

## Enums

### ModifierSelectionType

Controls how modifiers can be selected:

```typescript
enum ModifierSelectionType {
  SINGLE = 'SINGLE',       // User can select only one modifier from the group
  MULTIPLE = 'MULTIPLE',   // User can select multiple modifiers from the group
}
```

---

## Data Types

### ModifierGroup Response

```typescript
{
  id: string;                          // UUID
  businessId: string;                  // UUID
  name: string;                        // e.g., "Size", "Toppings"
  selectionType: ModifierSelectionType; // SINGLE | MULTIPLE
  isRequired: boolean;                 // Must customer select at least one modifier?
  minSelections: number;               // Minimum modifiers to select (default: 1)
  maxSelections?: number;              // Maximum modifiers to select (optional)
  position: number;                    // Display order (default: 0)
  isActive: boolean;                   // Is this group available? (default: true)
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  modifiers: Modifier[];               // Array of modifiers in this group
}
```

### Modifier Response

```typescript
{
  id: string;                 // UUID
  groupId: string;            // UUID of parent ModifierGroup
  name: string;               // e.g., "Medium", "Pepperoni"
  priceAdjustment: number;    // decimal, e.g., 1.50, 0.00
  position: number;           // Display order (default: 0)
  isActive: boolean;          // Is this modifier available? (default: true)
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Endpoints

### 1. Create Modifier Group with Modifiers

**POST** `/businesses/:businessId/modifier-groups`

Create a new modifier group along with its initial modifier items in a single atomic transaction.

#### Request Body

```typescript
{
  name: string;                                  // Required: e.g., "Size"
  selectionType?: ModifierSelectionType;        // Optional: default SINGLE
  isRequired?: boolean;                         // Optional: default false
  minSelections?: number;                       // Optional: default 1
  maxSelections?: number;                       // Optional: unlimited
  position?: number;                            // Optional: display order (default 0)
  isActive?: boolean;                           // Optional: default true
  modifiers?: [                                 // Optional: include modifier items
    {
      name: string;                             // Required: e.g., "Small"
      priceAdjustment: number;                  // Required: min 0
      position?: number;                        // Optional: display order
    },
    ...
  ]
}
```

#### Example Request

```bash
curl -X POST http://localhost:3000/businesses/123e4567-e89b-12d3-a456-426614174000/modifier-groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Size",
    "selectionType": "SINGLE",
    "isRequired": true,
    "minSelections": 1,
    "modifiers": [
      {
        "name": "Small",
        "priceAdjustment": 0.00,
        "position": 0
      },
      {
        "name": "Medium",
        "priceAdjustment": 1.50,
        "position": 1
      },
      {
        "name": "Large",
        "priceAdjustment": 2.50,
        "position": 2
      }
    ]
  }'
```

#### Response (201 Created)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "businessId": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Size",
  "selectionType": "SINGLE",
  "isRequired": true,
  "minSelections": 1,
  "maxSelections": null,
  "position": 0,
  "isActive": true,
  "createdAt": "2026-05-30T10:00:00.000Z",
  "updatedAt": "2026-05-30T10:00:00.000Z",
  "deletedAt": null,
  "modifiers": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "groupId": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Small",
      "priceAdjustment": "0.00",
      "position": 0,
      "isActive": true,
      "createdAt": "2026-05-30T10:00:00.000Z",
      "updatedAt": "2026-05-30T10:00:00.000Z"
    },
    ...
  ]
}
```

---

### 2. Get All Modifier Groups

**GET** `/businesses/:businessId/modifier-groups`

Retrieve all modifier groups for a business (excluding soft-deleted groups).

#### Query Parameters

None

#### Response (200 OK)

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "businessId": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Size",
    "selectionType": "SINGLE",
    "isRequired": true,
    "minSelections": 1,
    "maxSelections": null,
    "position": 0,
    "isActive": true,
    "createdAt": "2026-05-30T10:00:00.000Z",
    "updatedAt": "2026-05-30T10:00:00.000Z",
    "deletedAt": null,
    "modifiers": [...]
  },
  {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "businessId": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Toppings",
    "selectionType": "MULTIPLE",
    "isRequired": false,
    "minSelections": 0,
    "maxSelections": 5,
    "position": 1,
    "isActive": true,
    "createdAt": "2026-05-30T11:00:00.000Z",
    "updatedAt": "2026-05-30T11:00:00.000Z",
    "deletedAt": null,
    "modifiers": [...]
  }
]
```

#### Example

```bash
curl -X GET http://localhost:3000/businesses/123e4567-e89b-12d3-a456-426614174000/modifier-groups \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 3. Get Single Modifier Group

**GET** `/businesses/:businessId/modifier-groups/:groupId`

Retrieve a specific modifier group with all its modifiers.

#### Response (200 OK)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "businessId": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Size",
  "selectionType": "SINGLE",
  "isRequired": true,
  "minSelections": 1,
  "maxSelections": null,
  "position": 0,
  "isActive": true,
  "createdAt": "2026-05-30T10:00:00.000Z",
  "updatedAt": "2026-05-30T10:00:00.000Z",
  "deletedAt": null,
  "modifiers": [...]
}
```

#### Errors

- **404 Not Found**: Group not found or belongs to different business
- **401 Unauthorized**: Missing authentication

#### Example

```bash
curl -X GET http://localhost:3000/businesses/123e4567-e89b-12d3-a456-426614174000/modifier-groups/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 4. Update Modifier Group

**PUT** `/businesses/:businessId/modifier-groups/:groupId`

Partially update a modifier group. If `modifiers` array is provided, all existing modifiers are replaced.

#### Request Body (all fields optional)

```typescript
{
  name?: string;
  selectionType?: ModifierSelectionType;
  isRequired?: boolean;
  minSelections?: number;
  maxSelections?: number;
  position?: number;
  isActive?: boolean;
  modifiers?: [
    {
      name: string;
      priceAdjustment: number;
      position?: number;
    },
    ...
  ]
}
```

#### Response (200 OK)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "businessId": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Size",
  "selectionType": "SINGLE",
  "isRequired": true,
  "minSelections": 1,
  "maxSelections": null,
  "position": 0,
  "isActive": true,
  "createdAt": "2026-05-30T10:00:00.000Z",
  "updatedAt": "2026-05-30T10:00:00.000Z",
  "deletedAt": null,
  "modifiers": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "groupId": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Small",
      "priceAdjustment": "0.00",
      "position": 0,
      "isActive": true,
      "createdAt": "2026-05-30T10:00:00.000Z",
      "updatedAt": "2026-05-30T10:00:00.000Z"
    }
  ]
}
```

#### Example

```bash
curl -X PUT http://localhost:3000/businesses/123e4567-e89b-12d3-a456-426614174000/modifier-groups/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "isRequired": false,
    "minSelections": 0,
    "modifiers": [
      {
        "name": "Small",
        "priceAdjustment": 0.00,
        "position": 0
      },
      {
        "name": "Medium",
        "priceAdjustment": 1.50,
        "position": 1
      },
      {
        "name": "Large",
        "priceAdjustment": 3.00,
        "position": 2
      },
      {
        "name": "XL",
        "priceAdjustment": 4.00,
        "position": 3
      }
    ]
  }'
```

---

### 5. Delete Modifier Group

**DELETE** `/businesses/:businessId/modifier-groups/:groupId`

Soft-delete a modifier group. The group will be hidden and cannot be assigned to new products, but historical data is preserved.

#### Response (204 No Content)

No response body.

#### Example

```bash
curl -X DELETE http://localhost:3000/businesses/123e4567-e89b-12d3-a456-426614174000/modifier-groups/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Modifier Item Endpoints

### 6. Add Modifier to Group

**POST** `/businesses/:businessId/modifier-groups/:groupId/modifiers`

Add a new modifier item to an existing group.

#### Request Body

```typescript
{
  name: string;              // Required: e.g., "Bacon"
  priceAdjustment: number;   // Required: min 0
  position?: number;         // Optional: auto-incremented if not provided
}
```

#### Response (201 Created)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "groupId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Bacon",
  "priceAdjustment": "2.00",
  "position": 3,
  "isActive": true,
  "createdAt": "2026-05-30T10:05:00.000Z",
  "updatedAt": "2026-05-30T10:05:00.000Z"
}
```

#### Example

```bash
curl -X POST http://localhost:3000/businesses/123e4567-e89b-12d3-a456-426614174000/modifier-groups/550e8400-e29b-41d4-a716-446655440000/modifiers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Bacon",
    "priceAdjustment": 2.00
  }'
```

---

### 7. Get All Modifiers in Group

**GET** `/businesses/:businessId/modifier-groups/:groupId/modifiers`

Retrieve all modifiers for a specific group.

#### Response (200 OK)

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "groupId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Small",
    "priceAdjustment": "0.00",
    "position": 0,
    "isActive": true,
    "createdAt": "2026-05-30T10:00:00.000Z",
    "updatedAt": "2026-05-30T10:00:00.000Z"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "groupId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Medium",
    "priceAdjustment": "1.50",
    "position": 1,
    "isActive": true,
    "createdAt": "2026-05-30T10:00:00.000Z",
    "updatedAt": "2026-05-30T10:00:00.000Z"
  }
]
```

#### Example

```bash
curl -X GET http://localhost:3000/businesses/123e4567-e89b-12d3-a456-426614174000/modifier-groups/550e8400-e29b-41d4-a716-446655440000/modifiers \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 8. Update Modifier

**PUT** `/businesses/:businessId/modifier-groups/:groupId/modifiers/:modifierId`

Update a specific modifier's properties.

#### Request Body (all fields optional)

```typescript
{
  name?: string;
  priceAdjustment?: number;
  position?: number;
}
```

#### Response (200 OK)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "groupId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Small",
  "priceAdjustment": "0.50",
  "position": 0,
  "isActive": true,
  "createdAt": "2026-05-30T10:00:00.000Z",
  "updatedAt": "2026-05-30T10:10:00.000Z"
}
```

#### Example

```bash
curl -X PUT http://localhost:3000/businesses/123e4567-e89b-12d3-a456-426614174000/modifier-groups/550e8400-e29b-41d4-a716-446655440000/modifiers/550e8400-e29b-41d4-a716-446655440001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "priceAdjustment": 0.50
  }'
```

---

### 9. Delete Modifier

**DELETE** `/businesses/:businessId/modifier-groups/:groupId/modifiers/:modifierId`

Delete a modifier from a group.

#### Response (204 No Content)

No response body.

#### Example

```bash
curl -X DELETE http://localhost:3000/businesses/123e4567-e89b-12d3-a456-426614174000/modifier-groups/550e8400-e29b-41d4-a716-446655440000/modifiers/550e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Error Responses

### 400 Bad Request

```json
{
  "statusCode": 400,
  "message": "Bad request",
  "error": "Bad Request"
}
```

Common causes:
- Missing required fields
- Invalid field values
- Validation errors (e.g., negative price adjustment)

### 401 Unauthorized

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

Missing or invalid authentication token.

### 403 Forbidden

```json
{
  "statusCode": 403,
  "message": "Forbidden"
}
```

Insufficient permissions or accessing another business's data.

### 404 Not Found

```json
{
  "statusCode": 404,
  "message": "Modifier group 550e8400-e29b-41d4-a716-446655440000 not found"
}
```

Resource doesn't exist or has been deleted.

---

## Usage Examples

### Complete Workflow

```bash
#!/bin/bash

BUSINESS_ID="123e4567-e89b-12d3-a456-426614174000"
AUTH_TOKEN="your-jwt-token"
BASE_URL="http://localhost:3000"

# 1. Create a "Size" modifier group with 3 sizes
GROUP_RESPONSE=$(curl -s -X POST "$BASE_URL/businesses/$BUSINESS_ID/modifier-groups" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "name": "Size",
    "selectionType": "SINGLE",
    "isRequired": true,
    "minSelections": 1,
    "modifiers": [
      {"name": "Small", "priceAdjustment": 0.00, "position": 0},
      {"name": "Medium", "priceAdjustment": 1.50, "position": 1},
      {"name": "Large", "priceAdjustment": 2.50, "position": 2}
    ]
  }')

GROUP_ID=$(echo "$GROUP_RESPONSE" | jq -r '.id')
echo "Created group: $GROUP_ID"

# 2. Create a "Toppings" modifier group
TOPPINGS_GROUP=$(curl -s -X POST "$BASE_URL/businesses/$BUSINESS_ID/modifier-groups" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "name": "Toppings",
    "selectionType": "MULTIPLE",
    "isRequired": false,
    "minSelections": 0,
    "maxSelections": 5,
    "modifiers": [
      {"name": "Pepperoni", "priceAdjustment": 1.00},
      {"name": "Cheese", "priceAdjustment": 0.50},
      {"name": "Bacon", "priceAdjustment": 1.50}
    ]
  }')

TOPPINGS_ID=$(echo "$TOPPINGS_GROUP" | jq -r '.id')
echo "Created toppings group: $TOPPINGS_ID"

# 3. Get all modifier groups
curl -s -X GET "$BASE_URL/businesses/$BUSINESS_ID/modifier-groups" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.'

# 4. Add a new topping
curl -s -X POST "$BASE_URL/businesses/$BUSINESS_ID/modifier-groups/$TOPPINGS_ID/modifiers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "name": "Mushrooms",
    "priceAdjustment": 0.75
  }' | jq '.'
```

---

## Request/Response TypeScript Interfaces

For frontend integration:

```typescript
// Request types
export enum ModifierSelectionType {
  SINGLE = 'SINGLE',
  MULTIPLE = 'MULTIPLE',
}

export interface CreateModifierItemRequest {
  name: string;
  priceAdjustment: number;
  position?: number;
}

export interface CreateModifierGroupRequest {
  name: string;
  selectionType?: ModifierSelectionType;
  isRequired?: boolean;
  minSelections?: number;
  maxSelections?: number;
  position?: number;
  isActive?: boolean;
  modifiers?: CreateModifierItemRequest[];
}

export interface UpdateModifierGroupRequest {
  name?: string;
  selectionType?: ModifierSelectionType;
  isRequired?: boolean;
  minSelections?: number;
  maxSelections?: number;
  position?: number;
  isActive?: boolean;
  modifiers?: CreateModifierItemRequest[];
}

// Response types
export interface ModifierResponse {
  id: string;
  groupId: string;
  name: string;
  priceAdjustment: string; // Decimal as string
  position: number;
  isActive: boolean;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
}

export interface ModifierGroupResponse {
  id: string;
  businessId: string;
  name: string;
  selectionType: ModifierSelectionType;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number | null;
  position: number;
  isActive: boolean;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  deletedAt: string | null; // ISO date or null
  modifiers: ModifierResponse[];
}
```

---

## Notes

- All IDs are UUIDs.
- Monetary values (priceAdjustment) are stored and returned as decimal strings (e.g., "1.50") with precision 10,2.
- Modifier groups use soft delete (deletedAt timestamp), so they can be recovered if needed.
- Modifiers use hard delete.
- When updating a group with a new `modifiers` array, all existing modifiers are replaced (use with caution).
- Modifiers within a group are returned ordered by `position`.
- Transactions are used for atomic operations (create group + modifiers, update group + replace modifiers).


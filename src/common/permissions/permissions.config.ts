/**
 * Permissions configuration file
 *
 * This file previously contained ROLE_FEATURE_MAP and resolveStaffFeatures, which
 * have been replaced by a more granular permission system:
 *
 * New system:
 * - StaffPermission enum: defines granular actions (order_create, kitchen_update, etc.)
 * - ROLE_PERMISSION_MAP: maps staff roles to granted permissions
 * - FEATURE_CRUD: defines which permissions are needed for CRUD on each feature
 * - canDo() utility: checks if staff can perform an action on a feature
 *
 * This provides better separation of concerns:
 * - Business features (what's enabled) vs staff permissions (what they can do)
 * - Supports feature overrides at the staff level
 * - Enables future permission inheritance models
 *
 * Migration guide:
 * OLD: if (!business.features.includes(BusinessFeature.KITCHEN))
 * NEW: @RequirePermission(BusinessFeature.KITCHEN, 'update')
 *      or: if (!canDo(staff, business, BusinessFeature.KITCHEN, 'update'))
 *
 * OLD: ROLE_FEATURE_MAP[staff.role].includes(feature)
 * NEW: canDo(staff, business, feature, 'read')
 *
 * OLD: resolveStaffFeatures(staff, business)
 * NEW: Use canDo() with specific actions instead, or iterate via FEATURE_CRUD
 */

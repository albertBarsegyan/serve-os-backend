import { Staff } from '@modules/staff/entities/staff.entity';
import { Business } from '@modules/business/entities/business.entity';
import { BusinessFeature } from '@common/enums/business-feature.enum';
import {
  StaffPermission,
  ROLE_PERMISSION_MAP,
  FEATURE_CRUD,
} from '@common/enums/staff-permission.enum';

/**
 * Check if a business has a feature enabled
 */
export const hasFeature = (business: Business, feature: BusinessFeature): boolean =>
  business.features?.includes(feature) ?? false;

/**
 * Check if a staff role has a specific permission
 */
export const hasPermission = (staff: Staff, permission: StaffPermission): boolean =>
  ROLE_PERMISSION_MAP[staff.role]?.includes(permission) ?? false;

/**
 * Main permission check
 *
 * Flow:
 * 1. Staff featureOverrides take precedence over business feature flags
 * 2. What permission is needed for the action? → FEATURE_CRUD[feature][action]
 * 3. Does staff role have that permission?      → ROLE_PERMISSION_MAP
 */
export const canDo = (
  staff: Staff,
  business: Business,
  feature: BusinessFeature,
  action: 'create' | 'read' | 'update' | 'delete',
): boolean => {
  const override = staff.featureOverrides?.[feature];
  if (override === false) return false;
  if (override !== true && !hasFeature(business, feature)) return false;

  const crud = FEATURE_CRUD[feature];
  if (!crud) return false;

  const permission = crud[action];
  if (!permission) return false;

  return hasPermission(staff, permission);
};

/**
 * Returns true if staff can perform at least one of the given actions
 */
export const canDoAny = (
  staff: Staff,
  business: Business,
  feature: BusinessFeature,
  actions: Array<'create' | 'read' | 'update' | 'delete'>,
): boolean => actions.some((action) => canDo(staff, business, feature, action));

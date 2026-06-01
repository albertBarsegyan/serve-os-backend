import { SetMetadata } from '@nestjs/common';
import { BusinessFeature } from '@common/enums/business-feature.enum';

export type PermissionMetadata = {
  feature: BusinessFeature;
  action: 'create' | 'read' | 'update' | 'delete';
};

export const PERMISSION_KEY = 'permission';

/**
 * @RequirePermission decorator
 *
 * Mark route handlers with required permission for better granularity than basic feature checks.
 * Must be used in combination with PermissionGuard.
 *
 * Usage:
 * @RequirePermission(BusinessFeature.KITCHEN, 'update')
 * @Patch('kitchen/tickets/:id')
 * updateKitchenTicket() {}
 *
 * The PermissionGuard will then verify:
 * 1. The business has the KITCHEN feature enabled
 * 2. The staff member's role has permission for the 'update' action on KITCHEN
 *
 * @param feature - The BusinessFeature being accessed
 * @param action - The action being performed: 'create' | 'read' | 'update' | 'delete'
 */
export const RequirePermission = (feature: BusinessFeature, action: PermissionMetadata['action']) =>
  SetMetadata(PERMISSION_KEY, { feature, action });

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSION_KEY,
  PermissionMetadata,
} from '@common/decorators/require-permission.decorator';
import { Business } from '@modules/business/entities/business.entity';
import { Staff } from '@modules/staff/entities/staff.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthenticatedRequest } from '@common/types/authenticated-request.type';
import { canDo } from '@common/utils/permissions.util';

/**
 * PermissionGuard - Role and Feature-driven permission check
 *
 * Enforces granular permissions based on:
 * 1. Staff role (determines base permissions)
 * 2. Business feature availability
 * 3. Required action (create/read/update/delete)
 *
 * Behavior:
 * 1. Reads permission metadata from @RequirePermission(feature, action) decorator
 * 2. If no @RequirePermission is specified, allows access (opt-in per route)
 * 3. Owners pass through unconditionally — TenantGuard already verified ownership
 * 4. For staff, calls canDo(staff, business, feature, action) to verify permission
 * 5. Throws 403 Forbidden if permission check fails
 *
 * Example:
 * @RequirePermission(BusinessFeature.KITCHEN, 'update')
 * @Patch('kitchen/tickets/:id')
 * updateTicket() {} // Only accessible if:
 *                   // - business has KITCHEN feature
 *                   // - staff role has KITCHEN_UPDATE permission
 *
 * @see RequirePermission
 * @see canDo
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Read permission metadata from decorator
    const permission = this.reflector.getAllAndOverride<PermissionMetadata>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no permission required, skip check
    if (!permission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const payload = request.user;

    if (!payload) {
      throw new ForbiddenException('Permission check requires staff context');
    }

    // Owners have implicit full access — TenantGuard already verified business ownership
    if (payload.type === 'owner') {
      return true;
    }

    if (payload.type !== 'staff') {
      throw new ForbiddenException('Permission check requires staff context');
    }

    // Get staff from request
    let staff: Staff | null = null;
    if (request.staffId) {
      staff = await this.staffRepository.findOne({
        where: { id: request.staffId },
      });
    } else if (payload.staffId) {
      staff = await this.staffRepository.findOne({
        where: { id: payload.staffId },
      });
    }

    if (!staff) {
      throw new ForbiddenException('No staff context available for permission check');
    }

    // Get business from request
    const businessId = request.business?.id ?? request.businessId ?? null;
    if (!businessId) {
      throw new ForbiddenException('No business context available for permission check');
    }

    const business = await this.businessRepository.findOne({
      where: { id: businessId },
      select: ['id', 'features', 'type'],
    });

    if (!business) {
      throw new ForbiddenException('Business not found for permission check');
    }

    // Check permission using canDo utility
    const allowed = canDo(staff, business, permission.feature, permission.action);

    if (!allowed) {
      throw new ForbiddenException(
        `Insufficient permissions for ${permission.action} on ${permission.feature}`,
      );
    }

    return true;
  }
}

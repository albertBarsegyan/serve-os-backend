import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '@common/decorators/roles.decorator';
import { Role } from '@common/enums/role.enum';

/**
 * RolesGuard - Role-based access control guard
 *
 * Checks if the authenticated user's role is in the allowed roles list for a route.
 * Used in combination with the @Roles() decorator.
 *
 * Features:
 * - Reads roles metadata from @Roles() decorator applied to route handler or class
 * - Extracts user role from JWT payload (req.user.role)
 * - Returns 403 Forbidden if user's role is not in the allowed list
 * - If no roles are specified via @Roles(), the route is accessible to all authenticated users
 *
 * @example
 * @Roles(Role.OWNER, Role.ADMIN)
 * @Post('staff')
 * createStaff() { }
 * // Only users with OWNER or ADMIN role can access this endpoint
 *
 * @see Roles
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get allowed roles from @Roles() decorator metadata
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are specified, allow access (will be caught by auth guard if needed)
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRole = request.user?.role as Role;

    if (!userRole) {
      throw new ForbiddenException('User role not found in token');
    }

    const hasRequiredRole = requiredRoles.includes(userRole);
    if (!hasRequiredRole) {
      throw new ForbiddenException(
        `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}. User role: ${userRole}`,
      );
    }

    return true;
  }
}

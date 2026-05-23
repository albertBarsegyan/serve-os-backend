import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '@common/types/authenticated-request.type';
import { ROLES_KEY } from '@common/decorators/roles.decorator';
import { Role } from '@common/enums/role.enum';
import { PinoLogger } from 'nestjs-pino';

/**
 * RolesGuard - Role-based access control guard
 *
 * Checks if the authenticated user's role is in the allowed roles list for a route.
 * Used in combination with the @Roles() decorator.
 *
 * Features:
 * - Reads roles metadata from @Roles() decorator applied to route handler or class
 * - Extracts role from the active business context (req.business.role)
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
  constructor(
    private readonly logger: PinoLogger,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userRole = request.user?.role; // always from verified JWT

    if (!userRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    if (!requiredRoles.includes(userRole)) {
      this.logger.warn(
        `Access denied for role "${userRole}". Required: ${requiredRoles.join(', ')}`,
      );

      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '@common/types/authenticated-request.type';
import { ROLES_KEY } from '@common/decorators/roles.decorator';
import { Role } from '@common/enums/role.enum';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly logger: PinoLogger,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const payload = request.user;
    // Compare raw string values so Role and StaffRole enums both work
    const userRole: string | undefined = payload?.type === 'owner' ? Role.OWNER : payload?.role;

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

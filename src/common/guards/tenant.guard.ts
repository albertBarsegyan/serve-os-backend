import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PinoLogger } from 'nestjs-pino';

type AuthenticatedRequest = Request & {
  user?: {
    sub?: string;
    businessId?: string;
  };
};

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly logger: PinoLogger,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user || !user.businessId) {
      this.logger.warn(
        {
          path: request.url,
          method: request.method,
          userId: user?.sub,
        },
        'Tenant guard blocked request without business context',
      );
      throw new ForbiddenException('Invalid tenant access');
    }

    return true;
  }
}

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURES_KEY } from '@common/decorators/require-feature.decorator';
import { BusinessFeature } from '@common/enums/business-feature.enum';
import { AuthenticatedRequest } from '@common/types/authenticated-request.type';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredFeatures = this.reflector.getAllAndOverride<BusinessFeature[]>(FEATURES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredFeatures || requiredFeatures.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const available = new Set(request.business?.permissions ?? []);
    const missing = requiredFeatures.filter((feature) => !available.has(feature));

    if (missing.length > 0) {
      throw new ForbiddenException(`Missing required permissions: ${missing.join(', ')}`);
    }

    return true;
  }
}

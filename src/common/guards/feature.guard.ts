import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURES_KEY } from '@common/decorators/require-feature.decorator';
import { Business } from '@modules/business/entities/business.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessFeature } from '@common/enums/business-feature.enum';
import { AuthenticatedRequest } from '@common/types/authenticated-request.type';

/**
 * FeatureGuard - Capability-driven access control guard
 *
 * Enforces that the authenticated business has all required features enabled.
 * This is the capability-driven approach - instead of checking business type,
 * we check feature flags.
 *
 * Behavior:
 * 1. Reads required features metadata from the @RequireBusinessFeature() decorator
 * 2. Extracts businessId from request business context (req.businessId)
 * 3. Loads the Business entity and checks its enabled features
 * 4. Throws 403 Forbidden if any required feature is missing
 * 5. If no @RequireBusinessFeature is specified, allows access (feature checks disabled for that route)
 *
 * This keeps the authorization logic capability-driven and allows adding new features
 * without changing code that checks feature availability.
 *
 * Example:
 * @RequireBusinessFeature(BusinessFeature.KITCHEN)
 * @Post('tickets')
 * createTicket() {} // Only accessible if business.features includes KITCHEN
 *
 * @see RequireBusinessFeature
 */

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Read required features from decorator metadata
    const metadata = this.reflector.get<{
      features: BusinessFeature[];
      mode: 'any' | 'all';
    }>(FEATURES_KEY, context.getHandler());

    // If no features required, skip feature checks
    if (!metadata?.features || metadata.features.length === 0) {
      return true;
    }

    const { features, mode = 'all' } = metadata;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const businessId = request.business?.id ?? request.businessId ?? null;
    if (!businessId) {
      throw new ForbiddenException('No business context available to check features');
    }

    const business = await this.businessRepository.findOne({
      where: { id: businessId },
      select: ['id', 'features', 'type'],
    });
    if (!business) {
      throw new ForbiddenException('Business not found for feature check');
    }

    const businessFeatures = business.features || [];

    if (mode === 'any') {
      // At least one feature must be enabled
      const hasAny = features.some((f) => businessFeatures.includes(f));
      if (!hasAny) {
        throw new ForbiddenException(
          `Business must have at least one of the features: ${features.join(', ')}`,
        );
      }
    } else {
      // All features must be enabled
      const missing = features.filter((f) => !businessFeatures.includes(f));
      if (missing.length > 0) {
        throw new ForbiddenException(
          `Business does not have required features: ${missing.join(', ')}`,
        );
      }
    }

    return true;
  }
}

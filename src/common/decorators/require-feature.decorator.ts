import { SetMetadata } from '@nestjs/common';
import { BusinessFeature } from '@common/enums/business-feature.enum';

export const FEATURES_KEY = 'required_features';

/**
 * @RequireBusinessFeature decorator
 *
 * Mark route handlers with required business features for capability-driven access control.
 * Must be used in combination with FeatureGuard.
 *
 * Usage:
 * @RequireBusinessFeature(BusinessFeature.KITCHEN)
 * @Post('tickets')
 * createTicket() {}
 *
 * The FeatureGuard will then verify that the authenticated user's business has the KITCHEN feature enabled
 * before allowing access to this endpoint.
 *
 * @param features - One or more BusinessFeature flags required for this endpoint
 * @param mode
 */
export const RequireBusinessFeature = (features: BusinessFeature[], mode: 'any' | 'all' = 'all') =>
  SetMetadata(FEATURES_KEY, { features, mode });

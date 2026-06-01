import { BusinessFeature } from '@common/enums/business-feature.enum';
import { FEATURE_META } from '@common/constants/feature-presets';

export const hasFeature = (
  business: { features: BusinessFeature[] },
  feature: BusinessFeature,
): boolean => business.features.includes(feature);

export const isAddonFeature = (feature: BusinessFeature): boolean => !FEATURE_META[feature].isCore;

export const updateFeatures = (
  business: { features: BusinessFeature[] },
  newFeatures: BusinessFeature[],
): BusinessFeature[] => {
  const coreFeatures = business.features.filter((feature) => FEATURE_META[feature].isCore);
  const selectedFeatures = newFeatures.filter(
    (feature) => isAddonFeature(feature) || hasFeature(business, feature),
  );

  return [...new Set([...coreFeatures, ...selectedFeatures])];
};

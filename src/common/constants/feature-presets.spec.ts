import { BusinessFeature } from '../enums/business-feature.enum';
import { FEATURE_META } from './feature-presets';
import { hasFeature, isAddonFeature, updateFeatures } from '@common/utils/business-feature.utils';

describe('feature-presets utils', () => {
  it('detects enabled features', () => {
    expect(
      hasFeature(
        { features: [BusinessFeature.TABLES, BusinessFeature.TIPS] },
        BusinessFeature.TABLES,
      ),
    ).toBe(true);
    expect(
      hasFeature(
        { features: [BusinessFeature.TABLES, BusinessFeature.TIPS] },
        BusinessFeature.QR_ORDERING,
      ),
    ).toBe(false);
  });

  it('identifies toggleable features', () => {
    expect(isAddonFeature(BusinessFeature.TABLES)).toBe(false);
    expect(isAddonFeature(BusinessFeature.TIPS)).toBe(true);
    expect(FEATURE_META[BusinessFeature.TABLES].isCore).toBe(true);
  });

  it('preserves core features when updating selections', () => {
    expect(
      updateFeatures({ features: [BusinessFeature.TABLES, BusinessFeature.ORDER_DINE_IN] }, [
        BusinessFeature.TIPS,
        BusinessFeature.ORDER_DELIVERY,
        BusinessFeature.TABLES,
      ]),
    ).toEqual([
      BusinessFeature.TABLES,
      BusinessFeature.ORDER_DINE_IN,
      BusinessFeature.TIPS,
      BusinessFeature.ORDER_DELIVERY,
    ]);
  });
});

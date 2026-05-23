import { SetMetadata } from '@nestjs/common';

export const ALLOW_WITHOUT_BUSINESS_KEY = 'allowWithoutBusiness';
export const AllowWithoutBusiness = () => SetMetadata(ALLOW_WITHOUT_BUSINESS_KEY, true);

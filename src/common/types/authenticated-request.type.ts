import { Request } from 'express';
import { StaffRole } from '@common/enums/staff-role.enum';
import { BusinessFeature } from '@common/enums/business-feature.enum';
import { AuthPayload } from '@modules/auth/types/auth-payload.type';

export interface TenantBusinessContext {
  id: string;
  role: StaffRole | null;
  permissions: BusinessFeature[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;

  authPayload?: AuthPayload;

  ownerId?: string;
  userEmail?: string;

  staffId?: string;
  businessId?: string | null;
  staffRole?: StaffRole | null;

  business?: TenantBusinessContext | null;
}

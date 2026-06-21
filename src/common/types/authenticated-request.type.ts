import { Request } from 'express';
import { StaffRole } from '@common/enums/staff-role.enum';
import { BusinessFeature } from '@common/enums/business-feature.enum';
import { AuthPayload } from '@modules/auth/types/auth-payload.type';
import { TableSession } from '@modules/table-sessions/table-session.entity';

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

  /** Populated by GuestSessionGuard for routes that accept a guest session token. */
  tableSession?: TableSession | null;
}

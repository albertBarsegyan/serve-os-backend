import { Request } from 'express';
import { Role } from '@common/enums/role.enum';
import { StaffRole } from '@common/enums/staff-role.enum';

export interface TenantBusinessContext {
  id: string;
  role: StaffRole;
  permissions: StaffRole[];
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  hasBusiness: boolean;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  businessId?: string | null;
  business?: TenantBusinessContext | null;
}

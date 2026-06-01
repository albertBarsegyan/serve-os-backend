import { StaffRole } from '@common/enums/staff-role.enum';

export type OwnerPayload = {
  type: 'owner';
  userId: string;
  email: string;
};

export type StaffPayload = {
  type: 'staff';
  staffId: string;
  businessId: string;
  role: StaffRole;
};

export type AuthPayload = OwnerPayload | StaffPayload;

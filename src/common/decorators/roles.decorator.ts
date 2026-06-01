import { SetMetadata } from '@nestjs/common';
import { Role } from '@common/enums/role.enum';
import { StaffRole } from '@common/enums/staff-role.enum';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: (Role | StaffRole)[]) => SetMetadata(ROLES_KEY, roles);

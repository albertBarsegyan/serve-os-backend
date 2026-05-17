import { SetMetadata } from '@nestjs/common';
import { Role } from '@common/enums/role.enum';

export const ROLES_KEY = 'roles';

/**
 * @Roles decorator
 * Marks a route handler with allowed roles for role-based access control.
 * Must be used in combination with RolesGuard.
 *
 * @example
 * @Roles(Role.OWNER, Role.ADMIN)
 * @Post()
 * createStaff() { }
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

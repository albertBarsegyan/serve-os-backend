import { Role } from '@common/enums/role.enum';

/**
 * Role-based permission map defining which roles can invite which other roles.
 *
 * Role Descriptions:
 * - OWNER: Business owner with full administrative access. Can invite admins, waiters, and chefs.
 * - ADMIN: Administrator role with elevated permissions. Can invite waiters and chefs but cannot invite other admins.
 * - WAITER: Service staff member. No permission to invite other users.
 * - CHEF: Kitchen staff member. No permission to invite other users.
 *
 * @example
 * // Check if user can invite a specific role
 * const ownerRole = Role.OWNER;
 * if (CAN_INVITE[ownerRole].includes(Role.ADMIN)) {
 *   // Owner can invite admins
 * }
 */
export const CAN_INVITE: Record<Role, Role[]> = {
  [Role.OWNER]: [Role.ADMIN, Role.WAITER, Role.CHEF],
  [Role.ADMIN]: [Role.WAITER, Role.CHEF],
  [Role.WAITER]: [],
  [Role.CHEF]: [],
};

/**
 * Controller access matrix defining which roles can access which endpoints.
 *
 * Access Rules:
 * - OWNER: All endpoints
 * - ADMIN: staff, menu, orders endpoints
 * - WAITER: orders endpoints
 * - CHEF: kitchen / order-status endpoints
 *
 * This is used as a reference for applying @Roles() decorator to controllers.
 */
export const CONTROLLER_ACCESS_MATRIX: Record<
  string,
  {
    roles: Role[];
    description: string;
  }
> = {
  auth: {
    roles: [], // Auth endpoints use @Public() decorator, no role restriction
    description: 'Authentication endpoints (public)',
  },
  business: {
    roles: [Role.OWNER],
    description: 'Business management - owner only',
  },
  staff: {
    roles: [Role.OWNER, Role.ADMIN],
    description: 'Staff management',
  },
  menu: {
    roles: [Role.OWNER, Role.ADMIN],
    description: 'Menu management',
  },
  orders: {
    roles: [Role.OWNER, Role.ADMIN, Role.WAITER],
    description: 'Order management',
  },
  kitchen: {
    roles: [Role.OWNER, Role.ADMIN, Role.CHEF],
    description: 'Kitchen display system',
  },
  tables: {
    roles: [Role.OWNER, Role.ADMIN],
    description: 'Table management',
  },
  payments: {
    roles: [Role.OWNER, Role.ADMIN, Role.WAITER],
    description: 'Payment processing',
  },
};

/**
 * Role enum representing different user roles in the system.
 *
 * @enum {string}
 * @readonly
 *
 * OWNER - Business owner or account administrator
 * ADMIN - Business administrator with elevated permissions
 * WAITER - Service staff member
 * CHEF - Kitchen staff member
 */
export enum Role {
  OWNER = 'OWNER',
  WAITER = 'WAITER',
}

import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';

export const PLATFORM_PERMISSION_PREFIX = 'platform:' as const;
export const TENANT_PERMISSION_PREFIX = 'tenant:' as const;
/** Cross-cutting own-profile permissions — assignable on both platform and tenant roles. */
export const SELF_PERMISSION_PREFIX = 'self:' as const;
/**
 * Ops on platform Customer accounts (`platform:customers:*`).
 * Customers are platform users — these strings are platform-prefixed.
 * Tenant Role Management may also assign them so institution staff can serve
 * customers; Platform Role Management already includes them via `platform:*`.
 */
export const CUSTOMER_OPS_PERMISSION_PREFIX = 'platform:customers:' as const;

/**
 * Inbox VIEW/READ/DELETE only — not `notification:create` (broadcast leftover).
 * Assignable on both platform and tenant roles, same grant model as `self:*`.
 */
export const GLOBAL_INBOX_PERMISSIONS = [
  PERMISSIONS.GLOBAL.NOTIFICATIONS_VIEW,
  PERMISSIONS.GLOBAL.NOTIFICATIONS_READ,
  PERMISSIONS.GLOBAL.NOTIFICATIONS_DELETE,
] as const;

export type RolePermissionPrefix =
  typeof PLATFORM_PERMISSION_PREFIX | typeof TENANT_PERMISSION_PREFIX;

export function isSelfPermission(permissionName: string): boolean {
  return permissionName.startsWith(SELF_PERMISSION_PREFIX);
}

export function isInboxNotificationPermission(permissionName: string): boolean {
  return (GLOBAL_INBOX_PERMISSIONS as readonly string[]).includes(
    permissionName,
  );
}

/** Profile + inbox — not a resource scope; still RolePermission-assignable. */
export function isGlobalPermission(permissionName: string): boolean {
  return (
    isSelfPermission(permissionName) ||
    isInboxNotificationPermission(permissionName)
  );
}

export function isCustomerOpsPermission(permissionName: string): boolean {
  return permissionName.startsWith(CUSTOMER_OPS_PERMISSION_PREFIX);
}

export function isPermissionInScope(
  permissionName: string,
  prefix: RolePermissionPrefix,
): boolean {
  if (isGlobalPermission(permissionName)) {
    return true;
  }

  if (permissionName.startsWith(prefix)) {
    return true;
  }

  // Tenant staff must operate on platform Customer accounts
  if (
    prefix === TENANT_PERMISSION_PREFIX &&
    isCustomerOpsPermission(permissionName)
  ) {
    return true;
  }

  return false;
}

import { PERMISSIONS } from '../../auth/shared/constants/permissions.constant';

/**
 * User-management and role-configuration writes removed from the request
 * principal only. Login and session payloads keep the full role catalog so
 * the client can show every action. PermissionGuard rejects the writes.
 */
const SANDBOX_BLOCKED_MUTATIONS = new Set<string>([
  PERMISSIONS.TENANT.USERS_CREATE,
  PERMISSIONS.TENANT.USERS_UPDATE,
  PERMISSIONS.TENANT.USERS_DELETE,
  PERMISSIONS.TENANT.USERS_BLOCK,
  PERMISSIONS.TENANT.USERS_ASSIGN_ROLES,
  PERMISSIONS.TENANT.ROLES_CREATE,
  PERMISSIONS.TENANT.ROLES_UPDATE,
  PERMISSIONS.TENANT.ROLES_DELETE,
  PERMISSIONS.TENANT.ROLES_MANAGE,
  PERMISSIONS.TENANT.ROLES_ASSIGN,
  PERMISSIONS.PLATFORM.USERS_CREATE,
  PERMISSIONS.PLATFORM.USERS_UPDATE,
  PERMISSIONS.PLATFORM.USERS_DELETE,
  PERMISSIONS.PLATFORM.USERS_BLOCK,
  PERMISSIONS.PLATFORM.USERS_ASSIGN_ROLES,
  PERMISSIONS.PLATFORM.ROLES_CREATE,
  PERMISSIONS.PLATFORM.ROLES_UPDATE,
  PERMISSIONS.PLATFORM.ROLES_DELETE,
  PERMISSIONS.PLATFORM.ROLES_MANAGE,
]);

export function permissionsForSandboxSession(
  permissions: string[],
  isSandboxSession: boolean,
): string[] {
  if (!isSandboxSession) {
    return permissions;
  }

  return permissions.filter(
    (permission) => !SANDBOX_BLOCKED_MUTATIONS.has(permission),
  );
}

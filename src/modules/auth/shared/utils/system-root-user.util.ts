import {
  SYSTEM_ROOT_USER_EMAIL,
  SYSTEM_ROOT_USER_ID,
  SUPER_ADMIN_ROLE_KEY,
} from '../constants/roles.constant';
import {
  extractRoleKeys,
  type UserWithRolesAndPermissions,
} from './user-authorization.util';

export function isSystemRootUser(user: UserWithRolesAndPermissions): boolean {
  return extractRoleKeys(user).includes(SUPER_ADMIN_ROLE_KEY);
}

export function isSystemRootUserByRoleKeys(roles: string[]): boolean {
  return roles.includes(SUPER_ADMIN_ROLE_KEY);
}

/** Bootstrap master admin identity (userId / email). */
export function isSystemRootIdentity(userIdOrEmail: string): boolean {
  const normalized = userIdOrEmail.trim().toLowerCase();
  return (
    normalized === SYSTEM_ROOT_USER_ID.toLowerCase() ||
    normalized === SYSTEM_ROOT_USER_EMAIL.toLowerCase()
  );
}

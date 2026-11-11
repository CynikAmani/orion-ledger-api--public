import { Prisma } from '@prisma/client';
import { USER_IDENTITY_SELECT } from '../../../users/shared/selects/user-identity.select';
import type { TenantContext } from '../types/authenticated-user.type';

export const userRolesWithPermissionsInclude = {
  userRoles: {
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

/**
 * Lean select used by JwtStrategy so password hashes and reset secrets
 * never enter the request principal graph.
 */
export const authenticatedUserSelect = {
  ...USER_IDENTITY_SELECT,
  fullname: true,
  email: true,
  isBlocked: true,
  deletedAt: true,
  tenantId: true,
  tenant: {
    select: {
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionAccessEndsAt: true,
    },
  },
  userRoles: {
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  },
} as const;

export type UserWithRolesAndPermissions = Prisma.UserGetPayload<{
  include: typeof userRolesWithPermissionsInclude;
}>;

export type AuthenticatedUserRecord = Prisma.UserGetPayload<{
  select: typeof authenticatedUserSelect;
}>;

/**
 * Minimal role graph for authorization helpers.
 * Membership is User.tenantId (NULL = platform) — never inferred from UserRole.
 */
export type UserAuthorizationGraph = {
  tenantId?: string | null;
  userRoles: Array<{
    tenantId?: string | null;
    role: {
      key: string;
      tenantId?: string | null;
      rolePermissions: Array<{
        permission: { name: string };
      }>;
    };
  }>;
};

export function extractRoleKeys(user: UserAuthorizationGraph): string[] {
  return user.userRoles.map((userRole) => userRole.role.key);
}

export function extractPermissionNames(
  user: UserAuthorizationGraph,
): string[] {
  const permissionNames = user.userRoles.flatMap((userRole) =>
    userRole.role.rolePermissions.map(
      (rolePermission) => rolePermission.permission.name,
    ),
  );

  return [...new Set(permissionNames)];
}

/**
 * Tenant boundary comes from User.tenantId, not from UserRole.
 * roleKey is informational (roles held in that tenant).
 */
export function extractTenantContexts(
  user: UserAuthorizationGraph,
): TenantContext[] {
  const tenantId = user.tenantId;
  if (!tenantId) {
    return [];
  }

  const roleKeys = user.userRoles
    .filter((userRole) => resolveRoleTenantId(userRole) === tenantId)
    .map((userRole) => userRole.role.key);

  if (roleKeys.length === 0) {
    return [{ tenantId, roleKey: '' }];
  }

  return [...new Set(roleKeys)].map((roleKey) => ({ tenantId, roleKey }));
}

function resolveRoleTenantId(
  userRole: UserAuthorizationGraph['userRoles'][number],
): string | null {
  if (typeof userRole.tenantId === 'string' && userRole.tenantId.length > 0) {
    return userRole.tenantId;
  }

  if (
    typeof userRole.role.tenantId === 'string' &&
    userRole.role.tenantId.length > 0
  ) {
    return userRole.role.tenantId;
  }

  return null;
}

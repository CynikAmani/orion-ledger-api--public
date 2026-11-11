import { Prisma } from '@prisma/client';
import {
  SUPER_ADMIN_ROLE_KEY,
  SYSTEM_ROOT_USER_ID,
} from '../../../../auth/shared/constants/roles.constant';

/** Users with no tenant membership (platform scope). */
export const platformUserMembershipFilter = {
  tenantId: null,
} satisfies Prisma.UserWhereInput;

export function excludeUserManagementSubjects(
  extraExcludedUserIds: string[] = [],
): Prisma.UserWhereInput {
  const excluded = Array.from(
    new Set(
      [SYSTEM_ROOT_USER_ID, ...extraExcludedUserIds]
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  );

  return {
    userId: excluded.length === 1 ? { not: excluded[0] } : { notIn: excluded },
    userRoles: {
      none: {
        role: { key: SUPER_ADMIN_ROLE_KEY },
      },
    },
  };
}

export const excludeSuperAdminUserFilter = excludeUserManagementSubjects();

/**
 * Prisma where clause for platform-managed users only.
 * Excludes tenant members, protected Super Admin accounts, and optional extra identities.
 */
export function platformUserWhere(
  filters: Prisma.UserWhereInput = {},
  extraExcludedUserIds: string[] = [],
): Prisma.UserWhereInput {
  const clauses: Prisma.UserWhereInput[] = [
    platformUserMembershipFilter,
    excludeUserManagementSubjects(extraExcludedUserIds),
  ];

  if (Object.keys(filters).length > 0) {
    clauses.push(filters);
  }

  return { AND: clauses };
}

/**
 * Same catalog filter as User Management `findOne`.
 * Platform: tenantId IS NULL, Super Admin excluded. Customers are included.
 * Tenant: caller/target tenantId, Super Admin excluded.
 */
export function managedUserDetailWhere(
  scope: { kind: 'platform' } | { kind: 'tenant'; tenantId: string },
  userId: string,
): Prisma.UserWhereInput {
  if (scope.kind === 'platform') {
    return platformUserWhere({ userId });
  }

  return {
    AND: [{ userId }, { tenantId: scope.tenantId }, excludeSuperAdminUserFilter],
  };
}

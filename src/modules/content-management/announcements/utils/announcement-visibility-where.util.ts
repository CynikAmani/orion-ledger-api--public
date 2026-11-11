import { Prisma } from '@prisma/client';

/**
 * Authenticated banner feed.
 * Platform callers (no User.tenantId) see only platform-wide rows (tenantId null).
 * Tenant members see those plus their institution's rows.
 */
export function announcementVisibilityWhere(
  tenantId: string | null,
): Prisma.GlobalAnnouncementWhereInput {
  if (!tenantId) {
    return { tenantId: null };
  }

  return {
    OR: [{ tenantId: null }, { tenantId }],
  };
}

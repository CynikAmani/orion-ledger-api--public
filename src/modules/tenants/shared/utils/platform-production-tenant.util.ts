import { Prisma } from '@prisma/client';

/**
 * Filter for platform *statistical* aggregates only (dashboard KPIs,
 * subscription plan analysis, payment stats, loan volume rankings, etc.).
 *
 * Demo tenants remain visible for operational work: tenant management,
 * recording subscriptions on their behalf, payment transaction lists,
 * approvals, and support queues.
 */
export const PLATFORM_PRODUCTION_TENANT_WHERE = {
  deletedAt: null,
  isDemo: false,
} as const satisfies Prisma.TenantWhereInput;

/** Relation filter for statistical queries on models that join Tenant. */
export const PLATFORM_PRODUCTION_TENANT_RELATION = {
  tenant: PLATFORM_PRODUCTION_TENANT_WHERE,
} as const;

/**
 * SQL predicate for raw statistical queries already aliased as `t` on `tenants`.
 * Pair with: INNER JOIN tenants t ON t.tenant_id = <alias>.tenant_id
 */
export const PLATFORM_PRODUCTION_TENANT_SQL = Prisma.sql`
  t.is_demo = false
  AND t.deleted_at IS NULL
`;
import type { SubscriptionStatus } from '@prisma/client';

/**
 * Live request principal resolved from PostgreSQL during JWT validation.
 * Never populated from JWT claims other than the stable numeric `id` / `sub`.
 */

export interface TenantSubscriptionAccessSnapshot {
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  accessEndsAt: Date | null;
}

export interface TenantContext {
  tenantId: string;
  roleKey: string;
}

export interface AuthenticatedUser {
  /// Immutable relation key (User.id). Use this for FKs, JWT, and ownership checks.
  id: number;
  /// Public login handle (User.userId). Mutable; never store this on relations.
  userId: string;
  email: string | null;
  fullname: string;
  isBlocked: boolean | null;
  /// NULL = platform caller; set = exclusive tenant membership (loaded from DB, never JWT).
  tenantId: string | null;
  roles: string[];
  permissions: string[];
  tenantContexts: TenantContext[];
  /** Null for platform staff and customers. Loaded with the user row. */
  subscriptionAccess: TenantSubscriptionAccessSnapshot | null;
}

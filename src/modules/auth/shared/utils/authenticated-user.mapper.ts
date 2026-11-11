import type { SubscriptionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../types/authenticated-user.type';
import {
  extractPermissionNames,
  extractRoleKeys,
  extractTenantContexts,
  type UserAuthorizationGraph,
} from './user-authorization.util';

export type AuthenticatedUserSource = {
  id: number;
  userId: string;
  fullname: string;
  email: string | null;
  isBlocked: boolean | null;
  tenantId?: string | null;
  tenant?: {
    subscriptionStatus: SubscriptionStatus;
    trialEndsAt: Date | null;
    subscriptionAccessEndsAt: Date | null;
  } | null;
} & UserAuthorizationGraph;

export function toAuthenticatedUser(
  user: AuthenticatedUserSource,
): AuthenticatedUser {
  return {
    id: user.id,
    userId: user.userId,
    fullname: user.fullname,
    email: user.email,
    isBlocked: user.isBlocked,
    tenantId: user.tenantId ?? null,
    roles: extractRoleKeys(user),
    permissions: extractPermissionNames(user),
    tenantContexts: extractTenantContexts(user),
    subscriptionAccess: user.tenant
      ? {
          status: user.tenant.subscriptionStatus,
          trialEndsAt: user.tenant.trialEndsAt,
          accessEndsAt: user.tenant.subscriptionAccessEndsAt,
        }
      : null,
  };
}

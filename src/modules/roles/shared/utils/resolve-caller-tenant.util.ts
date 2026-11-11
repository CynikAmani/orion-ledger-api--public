import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../auth/shared/types/authenticated-user.type';

export const TENANT_ID_HEADER = 'x-tenant-id';

/**
 * Exclusive membership: the caller's User.tenantId is the tenant.
 * Optional x-tenant-id must match that value when sent.
 */
export function resolveCallerTenantId(
  user: AuthenticatedUser,
  requestedTenantId?: string | string[],
): string {
  const membership = user.tenantId;

  if (!membership) {
    throw new ForbiddenException('A tenant membership is required');
  }

  const requested =
    typeof requestedTenantId === 'string' ? requestedTenantId.trim() : '';

  if (requested.length > 0 && requested !== membership) {
    throw new ForbiddenException(
      'Requested tenant is outside the caller\'s active tenant context',
    );
  }

  return membership;
}

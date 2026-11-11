import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import type { AuthenticatedUser } from '../../../auth/shared/types/authenticated-user.type';
import { resolveCallerTenantId } from './resolve-caller-tenant.util';

function userWithTenant(tenantId: string | null): AuthenticatedUser {
  return {
    id: 1,
    userId: 'staff-1',
    email: 'staff@example.com',
    fullname: 'Staff',
    isBlocked: false,
    tenantId,
    roles: ['TENANT_MANAGER'],
    permissions: ['tenant:roles:manage'],
    tenantContexts: tenantId
      ? [{ tenantId, roleKey: 'TENANT_MANAGER' }]
      : [],
  };
}

describe('resolveCallerTenantId', () => {
  it('rejects callers with no tenant membership', () => {
    expect(() => resolveCallerTenantId(userWithTenant(null))).toThrow(
      ForbiddenException,
    );
  });

  it('uses the caller User.tenantId', () => {
    expect(resolveCallerTenantId(userWithTenant('tenant-a'))).toBe('tenant-a');
  });

  it('accepts x-tenant-id when it matches the caller membership', () => {
    expect(resolveCallerTenantId(userWithTenant('tenant-a'), 'tenant-a')).toBe(
      'tenant-a',
    );
  });

  it('rejects a requested tenant that is not the caller membership', () => {
    expect(() =>
      resolveCallerTenantId(userWithTenant('tenant-a'), 'tenant-x'),
    ).toThrow(ForbiddenException);
  });
});

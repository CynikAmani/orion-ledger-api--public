import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import type { AuthenticatedUser } from '../../auth/shared/types/authenticated-user.type';
import { assertPlatformSubscriptionOperator } from './assert-platform-subscription-operator.util';

function user(overrides: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: 1,
    userId: 'staff@example.com',
    email: 'staff@example.com',
    fullname: 'Staff',
    isBlocked: false,
    tenantId: null,
    roles: ['SUPER_ADMIN'],
    permissions: [],
    tenantContexts: [],
    ...overrides,
  };
}

describe('platform subscription operator', () => {
  it('allows platform staff', () => {
    expect(() => assertPlatformSubscriptionOperator(user({}))).not.toThrow();
  });

  it('rejects an institution member and a customer', () => {
    expect(() =>
      assertPlatformSubscriptionOperator(user({ tenantId: 'tenant-1' })),
    ).toThrow(ForbiddenException);
    expect(() =>
      assertPlatformSubscriptionOperator(user({ roles: ['CUSTOMER'] })),
    ).toThrow(ForbiddenException);
  });
});

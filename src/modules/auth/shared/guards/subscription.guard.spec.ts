import { HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ALLOW_EXPIRED_SUBSCRIPTION_KEY } from '../decorators/allow-expired-subscription.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SubscriptionGuard } from './subscription.guard';

describe('SubscriptionGuard', () => {
  let guard: SubscriptionGuard;
  let metadata: { public?: boolean; allowExpired?: boolean };

  beforeEach(() => {
    metadata = {};
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === IS_PUBLIC_KEY) {
          return metadata.public;
        }
        if (key === ALLOW_EXPIRED_SUBSCRIPTION_KEY) {
          return metadata.allowExpired;
        }
        return undefined;
      }),
    };
    guard = new SubscriptionGuard(reflector as unknown as Reflector);
  });

  function createContext(user?: {
    tenantId?: string | null;
    subscriptionAccess?: {
      status: 'TRIAL' | 'PAID' | 'EXPIRED';
      trialEndsAt: Date | null;
      accessEndsAt: Date | null;
    } | null;
  }): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows platform callers without a tenant', () => {
    expect(
      guard.canActivate(createContext({ tenantId: null, subscriptionAccess: null })),
    ).toBe(true);
  });

  it('allows an expired institution on a renewal route', () => {
    metadata.allowExpired = true;
    expect(
      guard.canActivate(
        createContext({
          tenantId: 'tenant-1',
          subscriptionAccess: {
            status: 'EXPIRED',
            trialEndsAt: null,
            accessEndsAt: new Date('2020-01-01T00:00:00.000Z'),
          },
        }),
      ),
    ).toBe(true);
  });

  it('rejects an expired institution on a business route', () => {
    expect(() =>
      guard.canActivate(
        createContext({
          tenantId: 'tenant-1',
          subscriptionAccess: {
            status: 'PAID',
            trialEndsAt: null,
            accessEndsAt: new Date('2020-01-01T00:00:00.000Z'),
          },
        }),
      ),
    ).toThrow(HttpException);
  });
});

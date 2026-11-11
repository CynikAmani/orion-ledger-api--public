import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SubscriptionStatus } from '@prisma/client';
import { TenantSubscriptionsService } from './tenant-subscriptions.service';

describe('TenantSubscriptionsService.access', () => {
  const findUnique = jest.fn<(args?: unknown) => Promise<unknown>>();
  const findMany = jest.fn<(args?: unknown) => Promise<unknown>>();
  const getPlatformContact = jest.fn<() => Promise<{
    contactPhone: string | null;
    whatsappPhone: string | null;
    contactEmail: string | null;
  }>>();
  const prisma = {
    tenant: { findUnique },
    subscription: { findMany },
  };
  const platformContact = {
    contactPhone: '+265111000000',
    whatsappPhone: '+265111000001',
    contactEmail: 'billing@orionloans-hub.africa',
  };

  let service: TenantSubscriptionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    getPlatformContact.mockResolvedValue(platformContact);
    service = new TenantSubscriptionsService(prisma as never, {
      getPlatformContact,
    } as never);
  });

  it('exposes trialEndsAt and accessEndsAt while on trial', async () => {
    const trialEndsAt = new Date('2026-11-15T00:00:00.000Z');
    findUnique.mockResolvedValue({
      subscriptionStatus: SubscriptionStatus.TRIAL,
      trialEndsAt,
      currentPlan: null,
    });
    findMany.mockResolvedValue([]);

    const access = await service.access('tenant-1');

    expect(access).toEqual(
      expect.objectContaining({
        accessState: 'TRIAL',
        onTrial: true,
        trialEndsAt: trialEndsAt.toISOString(),
        accessEndsAt: trialEndsAt.toISOString(),
        daysRemaining: expect.any(Number),
        platformContact,
      }),
    );
  });

  it('returns null trialEndsAt for an open-ended trial', async () => {
    findUnique.mockResolvedValue({
      subscriptionStatus: SubscriptionStatus.TRIAL,
      trialEndsAt: null,
      currentPlan: null,
    });
    findMany.mockResolvedValue([]);

    const access = await service.access('tenant-1');

    expect(access.trialEndsAt).toBeNull();
    expect(access.accessEndsAt).toBeNull();
    expect(access.onTrial).toBe(true);
    expect(access.platformContact).toEqual(platformContact);
  });
});

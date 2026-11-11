import { describe, expect, it } from '@jest/globals';
import {
  resolveTenantSubscriptionAccess,
  subscriptionTimelinePhase,
  tenantSubscriptionAllowsRequests,
  wholeDaysRemaining,
} from './subscription-access.util';

describe('whole days remaining', () => {
  const now = new Date('2026-09-26T08:00:00.000Z');

  it('counts a partial day as one day', () => {
    expect(wholeDaysRemaining(now, new Date('2026-09-26T09:00:00.000Z'))).toBe(
      1,
    );
  });

  it('returns null when access has no end', () => {
    expect(wholeDaysRemaining(now, null)).toBeNull();
  });
});

describe('tenant subscription access', () => {
  const now = new Date('2026-09-26T08:00:00.000Z');

  it('treats an open trial with no expiry as trial access', () => {
    expect(
      resolveTenantSubscriptionAccess({
        now,
        subscriptionStatus: 'TRIAL',
        trialEndsAt: null,
        openWindows: [],
      }),
    ).toEqual({
      accessState: 'TRIAL',
      onTrial: true,
      daysRemaining: null,
      accessStartsAt: null,
      accessEndsAt: null,
    });
  });

  it('counts days until a dated trial ends', () => {
    const access = resolveTenantSubscriptionAccess({
      now,
      subscriptionStatus: 'TRIAL',
      trialEndsAt: new Date('2026-10-01T08:00:00.000Z'),
      openWindows: [],
    });

    expect(access.onTrial).toBe(true);
    expect(access.daysRemaining).toBe(5);
    expect(access.accessEndsAt?.toISOString()).toBe('2026-10-01T08:00:00.000Z');
  });

  it('expires a trial that has already ended', () => {
    expect(
      resolveTenantSubscriptionAccess({
        now,
        subscriptionStatus: 'TRIAL',
        trialEndsAt: new Date('2026-09-01T08:00:00.000Z'),
        openWindows: [],
      }).accessState,
    ).toBe('EXPIRED');
  });

  it('uses stacked paid coverage through the furthest end', () => {
    const access = resolveTenantSubscriptionAccess({
      now,
      subscriptionStatus: 'TRIAL',
      trialEndsAt: new Date('2026-10-01T08:00:00.000Z'),
      openWindows: [
        {
          startsAt: new Date('2026-09-01T08:00:00.000Z'),
          endsAt: new Date('2026-10-10T08:00:00.000Z'),
        },
        {
          startsAt: new Date('2026-10-10T08:00:00.000Z'),
          endsAt: new Date('2026-11-09T08:00:00.000Z'),
        },
      ],
    });

    expect(access).toMatchObject({
      accessState: 'PAID',
      onTrial: false,
      daysRemaining: 44,
    });
    expect(access.accessStartsAt?.toISOString()).toBe(
      '2026-09-01T08:00:00.000Z',
    );
    expect(access.accessEndsAt?.toISOString()).toBe('2026-11-09T08:00:00.000Z');
  });
});

describe('tenant request access', () => {
  const now = new Date('2026-09-26T08:00:00.000Z');

  it('allows paid coverage until the stored end', () => {
    expect(
      tenantSubscriptionAllowsRequests({
        now,
        subscriptionStatus: 'PAID',
        trialEndsAt: null,
        subscriptionAccessEndsAt: new Date('2026-10-26T08:00:00.000Z'),
      }),
    ).toBe(true);
  });

  it('rejects a paid window that has passed without falling back to an old trial', () => {
    expect(
      tenantSubscriptionAllowsRequests({
        now,
        subscriptionStatus: 'PAID',
        trialEndsAt: new Date('2026-12-01T08:00:00.000Z'),
        subscriptionAccessEndsAt: new Date('2026-09-01T08:00:00.000Z'),
      }),
    ).toBe(false);
  });

  it('allows an open trial when no paid window is current', () => {
    expect(
      tenantSubscriptionAllowsRequests({
        now,
        subscriptionStatus: 'TRIAL',
        trialEndsAt: null,
        subscriptionAccessEndsAt: null,
      }),
    ).toBe(true);
  });
});

describe('subscription timeline phase', () => {
  const now = new Date('2026-09-26T08:00:00.000Z');

  it('marks a grant that has not started as upcoming', () => {
    expect(
      subscriptionTimelinePhase(
        now,
        new Date('2026-10-10T08:00:00.000Z'),
        new Date('2026-11-09T08:00:00.000Z'),
      ),
    ).toBe('upcoming');
  });

  it('marks the covering grant as active and a finished grant as past', () => {
    expect(
      subscriptionTimelinePhase(
        now,
        new Date('2026-09-01T08:00:00.000Z'),
        new Date('2026-10-01T08:00:00.000Z'),
      ),
    ).toBe('active');
    expect(
      subscriptionTimelinePhase(
        now,
        new Date('2026-08-01T08:00:00.000Z'),
        new Date('2026-09-01T08:00:00.000Z'),
      ),
    ).toBe('past');
  });
});

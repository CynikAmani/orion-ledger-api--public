import { describe, expect, it } from '@jest/globals';
import {
  canRemovePlatformSubscription,
  nextScheduledStart,
  subscriptionWindowsOverlap,
} from './subscription-coverage.util';

describe('subscription window overlap', () => {
  const left = {
    startsAt: new Date('2026-11-25T18:34:47.000Z'),
    endsAt: new Date('2026-12-25T18:34:47.000Z'),
  };

  it('treats a grant that starts when another ends as the next period', () => {
    expect(
      subscriptionWindowsOverlap(left, {
        startsAt: left.endsAt,
        endsAt: new Date('2027-01-24T18:34:47.000Z'),
      }),
    ).toBe(false);
  });

  it('rejects a grant that starts inside an existing period', () => {
    expect(
      subscriptionWindowsOverlap(left, {
        startsAt: new Date('2026-12-01T18:34:47.000Z'),
        endsAt: new Date('2026-12-31T18:34:47.000Z'),
      }),
    ).toBe(true);
  });
});

describe('next scheduled start', () => {
  const now = new Date('2026-09-27T08:00:00.000Z');

  it('starts now when nothing is open', () => {
    expect(nextScheduledStart(now, []).toISOString()).toBe(
      '2026-09-27T08:00:00.000Z',
    );
  });

  it('starts when the connected chain ends and stops at a gap', () => {
    const start = nextScheduledStart(now, [
      {
        startsAt: new Date('2026-09-26T18:34:47.000Z'),
        endsAt: new Date('2026-10-26T18:34:47.000Z'),
      },
      {
        startsAt: new Date('2026-10-26T18:34:47.000Z'),
        endsAt: new Date('2026-11-25T18:34:47.000Z'),
      },
      {
        startsAt: new Date('2026-12-25T18:34:47.000Z'),
        endsAt: new Date('2027-01-24T18:34:47.000Z'),
      },
    ]);

    expect(start.toISOString()).toBe('2026-11-25T18:34:47.000Z');
  });
});

describe('platform subscription removal', () => {
  const now = new Date('2026-09-27T08:00:00.000Z');

  it('allows a future Cash or EFT grant and keeps active, past, and online rows', () => {
    expect(
      canRemovePlatformSubscription({
        now,
        startsAt: new Date('2026-11-25T18:34:47.000Z'),
        paymentMethod: 'MANUAL_CASH',
      }),
    ).toBe(true);
    expect(
      canRemovePlatformSubscription({
        now,
        startsAt: new Date('2026-09-26T18:34:47.000Z'),
        paymentMethod: 'MANUAL_CASH',
      }),
    ).toBe(false);
    expect(
      canRemovePlatformSubscription({
        now,
        startsAt: new Date('2026-08-01T00:00:00.000Z'),
        paymentMethod: 'ELECTRONIC_FUNDS_TRANSFER',
      }),
    ).toBe(false);
    expect(
      canRemovePlatformSubscription({
        now,
        startsAt: new Date('2026-11-25T18:34:47.000Z'),
        paymentMethod: 'ONLINE',
      }),
    ).toBe(false);
  });
});

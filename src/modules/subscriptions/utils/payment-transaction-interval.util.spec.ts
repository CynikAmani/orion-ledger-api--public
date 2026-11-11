import { describe, expect, it } from '@jest/globals';
import { paymentTransactionIntervalWindow } from './payment-transaction-interval.util';

describe('payment transaction intervals', () => {
  const now = new Date('2026-09-27T11:54:00.000Z');

  it('opens this month at midnight in Blantyre', () => {
    expect(paymentTransactionIntervalWindow('THIS_MONTH', now)).toEqual({
      startsAt: new Date('2026-08-31T22:00:00.000Z'),
      endsAt: now,
    });
  });

  it('opens this year on 1 January in Blantyre', () => {
    expect(
      paymentTransactionIntervalWindow(
        'THIS_YEAR',
        now,
      ).startsAt?.toISOString(),
    ).toBe('2025-12-31T22:00:00.000Z');
  });

  it('leaves all time open', () => {
    expect(
      paymentTransactionIntervalWindow('ALL_TIME', now).startsAt,
    ).toBeNull();
  });
});

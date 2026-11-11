import { Prisma } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import { findPaymentVerificationMismatch } from './payment-verification.util';
import { resolveSubscriptionWindow } from './subscription-coverage.util';

describe('subscription payment verification', () => {
  const payment = {
    transactionReference: 'ol_abc',
    amount: new Prisma.Decimal('15000.00'),
    currency: 'MWK',
  };

  it('accepts a verified charge that matches the stored snapshot', () => {
    expect(
      findPaymentVerificationMismatch(payment, {
        transactionReference: 'ol_abc',
        providerTransactionId: 'pch_1',
        status: 'success',
        amount: 15000,
        currency: 'mwk',
      }),
    ).toBeNull();
  });

  it('rejects a verified amount that does not match the plan snapshot', () => {
    expect(
      findPaymentVerificationMismatch(payment, {
        transactionReference: 'ol_abc',
        providerTransactionId: null,
        status: 'success',
        amount: 1,
        currency: 'MWK',
      }),
    ).toBe('Verified amount does not match the stored payment amount');
  });
});

describe('subscription coverage window', () => {
  it('starts a new window now when nothing is open', () => {
    const now = new Date('2026-09-26T08:00:00.900Z');
    const window = resolveSubscriptionWindow({
      now,
      durationInDays: 30,
      openCoverageEndsAt: null,
    });

    expect(window.startsAt.toISOString()).toBe('2026-09-26T08:00:00.000Z');
    expect(window.endsAt.toISOString()).toBe('2026-10-26T08:00:00.000Z');
  });

  it('starts the next window when the current one ends', () => {
    const window = resolveSubscriptionWindow({
      now: new Date('2026-09-26T08:00:00.000Z'),
      durationInDays: 30,
      openCoverageEndsAt: new Date('2026-10-10T08:00:00.000Z'),
    });

    expect(window.startsAt.toISOString()).toBe('2026-10-10T08:00:00.000Z');
    expect(window.endsAt.toISOString()).toBe('2026-11-09T08:00:00.000Z');
  });
});

import { describe, expect, it } from '@jest/globals';
import { toPaymentTransactionEvent } from './subscription-events.util';

describe('payment transaction events', () => {
  it('reads the checkout and settlement steps from the transaction', () => {
    const initiated = toPaymentTransactionEvent({
      id: 'evt-1',
      action: 'SUBSCRIPTION_PAYMENT_INITIATED',
      createdAt: new Date('2026-09-26T18:34:47.000Z'),
      user: { id: 4, fullname: 'Ada Banda', email: 'ada@example.com' },
      payload: {
        display: {
          category: 'METADATA',
          changes: [
            { field: 'transactionReference', from: null, to: 'ol_abc' },
            { field: 'amount', from: null, to: '63000.00' },
            { field: 'currency', from: null, to: 'MWK' },
            { field: 'status', from: null, to: 'PENDING' },
          ],
        },
      },
    });

    expect(initiated).toEqual({
      id: 'evt-1',
      type: 'INITIATED',
      occurredAt: '2026-09-26T18:34:47.000Z',
      status: 'PENDING',
      transactionReference: 'ol_abc',
      amount: '63000.00',
      currency: 'MWK',
      failureReason: null,
      actor: { id: 4, fullname: 'Ada Banda', email: 'ada@example.com' },
    });
  });

  it('keeps a failed payment reason and ignores subscription record rows', () => {
    expect(
      toPaymentTransactionEvent({
        id: 'evt-2',
        action: 'SUBSCRIPTION_PAYMENT_FAILED',
        createdAt: new Date('2026-09-26T18:40:00.000Z'),
        user: null,
        payload: {
          display: {
            category: 'METADATA',
            changes: [
              { field: 'status', from: 'PENDING', to: 'FAILED' },
              {
                field: 'failureReason',
                from: null,
                to: 'Payment was declined',
              },
            ],
          },
        },
      }),
    ).toMatchObject({
      type: 'FAILED',
      status: 'FAILED',
      failureReason: 'Payment was declined',
    });

    expect(
      toPaymentTransactionEvent({
        id: 'evt-3',
        action: 'SUBSCRIPTION_MANUAL_RECORDED',
        createdAt: new Date('2026-09-26T18:40:00.000Z'),
        user: null,
        payload: { display: { category: 'METADATA', changes: [] } },
      }),
    ).toBeNull();
  });
});

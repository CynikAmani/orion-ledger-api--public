import { describe, expect, it } from '@jest/globals';
import {
  isPaychanguPaymentEvent,
  mapPaychanguWebhookPayload,
  shouldIgnorePaychanguEvent,
} from './paychangu-webhook-payload.util';

describe('PayChangu webhook payload', () => {
  it('reads payment fields from the nested data object', () => {
    expect(
      mapPaychanguWebhookPayload({
        event_type: 'checkout.payment',
        data: {
          tx_ref: 'ol_abc',
          reference: 'pch_1',
          status: 'success',
          amount: '15000.00',
          currency: 'MWK',
          mode: 'test',
        },
      }),
    ).toEqual({
      eventType: 'checkout.payment',
      transactionReference: 'ol_abc',
      providerTransactionId: 'pch_1',
      status: 'success',
      amount: 15000,
      currency: 'MWK',
      mode: 'test',
    });
  });

  it('treats checkout and charge events as payments and ignores payouts', () => {
    expect(isPaychanguPaymentEvent('checkout.payment')).toBe(true);
    expect(isPaychanguPaymentEvent('api.charge.payment')).toBe(true);
    expect(isPaychanguPaymentEvent(null)).toBe(true);
    expect(shouldIgnorePaychanguEvent('api.payout')).toBe(true);
    expect(isPaychanguPaymentEvent('api.payout')).toBe(false);
  });
});

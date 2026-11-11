import { describe, expect, it } from '@jest/globals';
import { buildSubscriptionPaymentProviderUrls } from './subscription-payment-return-url.util';

describe('subscription payment provider urls', () => {
  it('builds callback and return from the request origin', () => {
    expect(
      buildSubscriptionPaymentProviderUrls(
        'https://ledger.example.com/',
        'ol_abc',
      ),
    ).toEqual({
      callbackUrl:
        'https://ledger.example.com/app/subscription/checkout/callback?tx_ref=ol_abc',
      returnUrl:
        'https://ledger.example.com/app/subscription/checkout/return?tx_ref=ol_abc',
    });
  });
});

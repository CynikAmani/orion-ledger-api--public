import { createHmac } from 'crypto';
import { describe, expect, it } from '@jest/globals';
import {
  computePaychanguSignature,
  verifyPaychanguSignature,
} from './paychangu-signature.util';

describe('PayChangu webhook signature', () => {
  const secret = 'whsec-test';
  const rawBody = Buffer.from(
    '{"event_type":"checkout.payment","tx_ref":"ol_1"}',
  );

  it('accepts an HMAC-SHA256 hex signature of the raw body', () => {
    const signature = computePaychanguSignature(rawBody, secret);

    expect(
      verifyPaychanguSignature({
        rawBody,
        signatureHeader: signature.toUpperCase(),
        webhookSecret: secret,
      }),
    ).toBe(true);
  });

  it('rejects a signature made with a different secret', () => {
    const signature = createHmac('sha256', 'other-secret')
      .update(rawBody)
      .digest('hex');

    expect(
      verifyPaychanguSignature({
        rawBody,
        signatureHeader: signature,
        webhookSecret: secret,
      }),
    ).toBe(false);
  });

  it('rejects a tampered body and an empty secret', () => {
    const signature = computePaychanguSignature(rawBody, secret);

    expect(
      verifyPaychanguSignature({
        rawBody: Buffer.from(
          '{"event_type":"checkout.payment","tx_ref":"ol_2"}',
        ),
        signatureHeader: signature,
        webhookSecret: secret,
      }),
    ).toBe(false);
    expect(
      verifyPaychanguSignature({
        rawBody,
        signatureHeader: signature,
        webhookSecret: '',
      }),
    ).toBe(false);
  });
});

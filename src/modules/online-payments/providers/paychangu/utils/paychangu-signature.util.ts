import { createHmac, timingSafeEqual } from 'crypto';

export function computePaychanguSignature(
  rawBody: Buffer | string,
  webhookSecret: string,
): string {
  return createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
}

export function verifyPaychanguSignature(params: {
  rawBody: Buffer | string;
  signatureHeader: string;
  webhookSecret: string;
}): boolean {
  if (!params.webhookSecret) {
    return false;
  }

  const expected = computePaychanguSignature(
    params.rawBody,
    params.webhookSecret,
  ).toLowerCase();
  const provided = params.signatureHeader.trim().toLowerCase();

  if (provided.length === 0 || provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

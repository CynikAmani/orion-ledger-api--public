import { createHash, randomInt, timingSafeEqual } from 'crypto';

export function generateMfaPin(): string {
  return randomInt(100000, 1000000).toString();
}

export function hashMfaPin(pin: string): string {
  return createHash('sha256').update(pin).digest('hex');
}

export function isMfaPinMatch(providedPin: string, storedHash: string): boolean {
  const incomingHash = hashMfaPin(providedPin);
  const incomingBuffer = Buffer.from(incomingHash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');

  if (incomingBuffer.length !== storedBuffer.length) {
    return false;
  }

  return timingSafeEqual(incomingBuffer, storedBuffer);
}

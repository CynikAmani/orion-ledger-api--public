import { describe, expect, it } from '@jest/globals';
import {
  generateResetPin,
  hashResetPin,
  isResetPinMatch,
} from './reset-pin.util';

describe('password reset PIN hashing', () => {
  it('stores bcrypt hashes, never plaintext PINs', async () => {
    const pin = generateResetPin();
    const hashed = await hashResetPin(pin);

    expect(pin).toMatch(/^\d{6}$/);
    expect(hashed).not.toBe(pin);
    expect(hashed.startsWith('$2')).toBe(true);
    expect(hashed.length).toBeGreaterThan(20);
  });

  it('validates matching PINs via bcrypt.compare', async () => {
    const pin = '123456';
    const hashed = await hashResetPin(pin);

    await expect(isResetPinMatch(pin, hashed)).resolves.toBe(true);
    await expect(isResetPinMatch('000000', hashed)).resolves.toBe(false);
  });
});

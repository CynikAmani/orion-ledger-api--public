import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { PASSWORD_HASH_ROUNDS } from '../../shared/constants/password.constant';

export function generateResetPin(): string {
  return randomInt(100000, 1000000).toString();
}

export async function hashResetPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, PASSWORD_HASH_ROUNDS);
}

export async function isResetPinMatch(
  providedPin: string,
  storedHash: string,
): Promise<boolean> {
  return bcrypt.compare(providedPin, storedHash);
}

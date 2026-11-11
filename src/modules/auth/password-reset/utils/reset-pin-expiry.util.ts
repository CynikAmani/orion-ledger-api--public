const RESET_PIN_TTL_SECONDS = 300;
const RESET_PIN_TTL_MS = RESET_PIN_TTL_SECONDS * 1000;

export function getResetPinTtlSeconds(): number {
  return RESET_PIN_TTL_SECONDS;
}

export function getResetPinTtlMinutes(): number {
  return RESET_PIN_TTL_SECONDS / 60;
}

export function createResetPinExpiryDate(): Date {
  return new Date(Date.now() + RESET_PIN_TTL_MS);
}

export function isResetPinExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() <= Date.now();
}

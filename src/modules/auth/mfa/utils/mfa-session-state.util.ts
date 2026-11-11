import { Prisma } from '@prisma/client';
import { MFA_PIN_TTL_MS } from '../constants/mfa.constant';
import { hashMfaPin } from './mfa-pin.util';

export interface MfaSessionState {
  hashedPin: string;
  expiresAt: number;
  resendCount: number;
  lastSentAt: number;
  attempts: number;
}

export interface SessionStateWithMfa {
  mfa?: MfaSessionState;
  sessionId?: string;
  refreshToken?: string;
  expiresAt?: number | string;
}

function toEpochMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const numericValue = Number(value);
    if (/^\d+$/.test(value.trim()) && Number.isFinite(numericValue)) {
      return numericValue;
    }

    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

function toNonNegativeInt(value: unknown, defaultValue: number): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return defaultValue;
  }

  return Math.floor(parsed);
}

export function createMfaSessionState(pin: string): MfaSessionState {
  const now = Date.now();

  return {
    hashedPin: hashMfaPin(pin),
    expiresAt: now + MFA_PIN_TTL_MS,
    resendCount: 0,
    lastSentAt: now,
    attempts: 0,
  };
}

export function parseMfaSessionState(
  value: Prisma.JsonValue | null,
): MfaSessionState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const mfa = record.mfa;

  if (!mfa || typeof mfa !== 'object' || Array.isArray(mfa)) {
    return null;
  }

  const mfaRecord = mfa as Record<string, unknown>;
  const { hashedPin, expiresAt, resendCount, lastSentAt, attempts } = mfaRecord;

  if (typeof hashedPin !== 'string' || hashedPin.length === 0) {
    return null;
  }

  const parsedExpiresAt = toEpochMs(expiresAt);
  const parsedLastSentAt = toEpochMs(lastSentAt);

  if (parsedExpiresAt === null || parsedLastSentAt === null) {
    return null;
  }

  return {
    hashedPin,
    expiresAt: parsedExpiresAt,
    resendCount: toNonNegativeInt(resendCount, 0),
    lastSentAt: parsedLastSentAt,
    attempts: toNonNegativeInt(attempts, 0),
  };
}

export function buildSessionStateWithMfa(
  mfa: MfaSessionState,
): Prisma.InputJsonValue {
  return { mfa } as unknown as Prisma.InputJsonValue;
}

export function isMfaSessionExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}

export function secondsSinceLastMfaSend(lastSentAt: number): number {
  return (Date.now() - lastSentAt) / 1000;
}

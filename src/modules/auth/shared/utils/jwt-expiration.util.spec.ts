import { describe, expect, it } from '@jest/globals';
import {
  cappedAccessTtlSeconds,
  jwtExpiresInToMs,
  resolveJwtExpiresIn,
} from './jwt-expiration.util';

describe('jwt expiration', () => {
  it('defaults blank or unknown values to 3600s', () => {
    expect(resolveJwtExpiresIn(undefined)).toBe('3600s');
    expect(resolveJwtExpiresIn('')).toBe('3600s');
    expect(resolveJwtExpiresIn('nope')).toBe('3600s');
  });

  it('accepts jsonwebtoken number-as-seconds and unit strings', () => {
    expect(resolveJwtExpiresIn(3600)).toBe(3600);
    expect(resolveJwtExpiresIn('3600')).toBe(3600);
    expect(resolveJwtExpiresIn('15m')).toBe('15m');
    expect(resolveJwtExpiresIn(' 1 h ')).toBe('1h');
  });

  it('converts to cookie maxAge milliseconds', () => {
    expect(jwtExpiresInToMs(3600)).toBe(3_600_000);
    expect(jwtExpiresInToMs('15m')).toBe(15 * 60 * 1000);
    expect(jwtExpiresInToMs('3600s')).toBe(3_600_000);
  });

  it('caps an access token at the shorter of the JWT ttl and a session end', () => {
    const previous = process.env.JWT_EXPIRATION_TIME;
    process.env.JWT_EXPIRATION_TIME = '3600';
    const now = Date.parse('2026-11-07T12:00:00.000Z');

    try {
      expect(
        cappedAccessTtlSeconds(new Date('2026-11-07T12:20:00.000Z'), now),
      ).toBe(20 * 60);
      expect(
        cappedAccessTtlSeconds(new Date('2026-11-07T14:00:00.000Z'), now),
      ).toBe(3600);
    } finally {
      if (previous === undefined) {
        delete process.env.JWT_EXPIRATION_TIME;
      } else {
        process.env.JWT_EXPIRATION_TIME = previous;
      }
    }
  });
});

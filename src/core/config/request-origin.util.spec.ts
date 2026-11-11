import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import type { Request } from 'express';
import {
  extractRequestOriginCandidate,
  resolveOauthFrontendOrigin,
  resolveRequestOrigin,
} from './request-origin.util';

const DEV_ORIGIN = 'http://localhost:5173';
const PROD_ORIGIN = 'https://app.orionledger.com';
const ALLOWED = [DEV_ORIGIN, PROD_ORIGIN];

function request(partial: {
  origin?: string;
  referer?: string;
  query?: Request['query'];
}): Pick<Request, 'headers' | 'query'> {
  return {
    headers: {
      origin: partial.origin,
      referer: partial.referer,
    },
    query: partial.query ?? {},
  };
}

describe('extractRequestOriginCandidate', () => {
  it('prefers the Origin header', () => {
    expect(
      extractRequestOriginCandidate(
        request({
          origin: `${DEV_ORIGIN}/`,
          referer: `${PROD_ORIGIN}/dashboard`,
          query: { origin: PROD_ORIGIN },
        }),
      ),
    ).toBe(DEV_ORIGIN);
  });

  it('uses query.origin when Origin is absent (Google OAuth start)', () => {
    expect(
      extractRequestOriginCandidate(
        request({
          referer: `${PROD_ORIGIN}/login`,
          query: { origin: DEV_ORIGIN },
        }),
      ),
    ).toBe(DEV_ORIGIN);
  });

  it('falls back to Referer origin', () => {
    expect(
      extractRequestOriginCandidate(
        request({ referer: `${PROD_ORIGIN}/auth/login?next=/home` }),
      ),
    ).toBe(PROD_ORIGIN);
  });

  it('returns null when no origin can be read', () => {
    expect(extractRequestOriginCandidate(request({}))).toBeNull();
  });
});

describe('resolveRequestOrigin', () => {
  it('returns the allowlisted request origin', () => {
    expect(resolveRequestOrigin(request({ origin: DEV_ORIGIN }), ALLOWED)).toBe(
      DEV_ORIGIN,
    );
  });

  it('rejects a missing origin', () => {
    expect(() => resolveRequestOrigin(request({}), ALLOWED)).toThrow(
      BadRequestException,
    );
  });

  it('rejects an origin that is not a subscriber', () => {
    expect(() =>
      resolveRequestOrigin(
        request({ origin: 'https://evil.example' }),
        ALLOWED,
      ),
    ).toThrow(ForbiddenException);
  });
});

describe('resolveOauthFrontendOrigin', () => {
  it('uses OAuth state when present', () => {
    expect(
      resolveOauthFrontendOrigin(
        PROD_ORIGIN,
        request({ origin: 'https://accounts.google.com' }),
        ALLOWED,
      ),
    ).toBe(PROD_ORIGIN);
  });

  it('falls back to the request when state is empty', () => {
    expect(
      resolveOauthFrontendOrigin('', request({ origin: DEV_ORIGIN }), ALLOWED),
    ).toBe(DEV_ORIGIN);
  });
});

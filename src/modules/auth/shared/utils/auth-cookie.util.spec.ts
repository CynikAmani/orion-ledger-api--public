import { describe, expect, it } from '@jest/globals';
import type { Request } from 'express';
import { resolveIncomingRefreshToken } from './auth-cookie.util';

function requestWithCookie(cookie?: string): Request {
  return { headers: cookie ? { cookie } : {} } as Request;
}

describe('resolveIncomingRefreshToken', () => {
  it('prefers a non-empty body token over the cookie', () => {
    expect(
      resolveIncomingRefreshToken(
        requestWithCookie('refresh_token=cookie-token'),
        'body-token',
      ),
    ).toBe('body-token');
  });

  it('falls back to the httpOnly refresh cookie when the body omits the token', () => {
    expect(
      resolveIncomingRefreshToken(
        requestWithCookie('refresh_token=cookie-token'),
        undefined,
      ),
    ).toBe('cookie-token');
  });

  it('returns null when neither body nor cookie supplies a token', () => {
    expect(resolveIncomingRefreshToken(requestWithCookie(), '')).toBeNull();
  });
});

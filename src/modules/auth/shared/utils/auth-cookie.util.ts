import type { CookieOptions, Request, Response } from 'express';
import type { TokenPair } from '../../auth/services/auth.service';
import { accessTokenTtlMsFromEnv } from './jwt-expiration.util';

export const ACCESS_TOKEN_COOKIE = 'token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

const REFRESH_TOKEN_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function authCookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    maxAge,
  };
}

export function setAuthCookies(
  response: Response,
  tokens: TokenPair,
  options?: { maxAgeMs?: number },
): void {
  const accessMaxAge = options?.maxAgeMs ?? accessTokenTtlMsFromEnv();
  const refreshMaxAge = options?.maxAgeMs ?? REFRESH_TOKEN_COOKIE_MAX_AGE_MS;

  response.cookie(
    ACCESS_TOKEN_COOKIE,
    tokens.accessToken,
    authCookieOptions(accessMaxAge),
  );
  response.cookie(
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    authCookieOptions(refreshMaxAge),
  );
}

export function clearAuthCookies(response: Response): void {
  const options = authCookieOptions(0);

  response.clearCookie(ACCESS_TOKEN_COOKIE, options);
  response.clearCookie(REFRESH_TOKEN_COOKIE, options);
}

function extractCookieValue(
  request: Request,
  cookieName: string,
): string | null {
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const prefix = `${cookieName}=`;

  for (const segment of cookieHeader.split(';')) {
    const trimmedSegment = segment.trim();

    if (!trimmedSegment.startsWith(prefix)) {
      continue;
    }

    const value = trimmedSegment.slice(prefix.length);
    return value.length > 0 ? decodeURIComponent(value) : null;
  }

  return null;
}

export function extractAccessTokenFromCookie(request: Request): string | null {
  return extractCookieValue(request, ACCESS_TOKEN_COOKIE);
}

export function extractRefreshTokenFromCookie(request: Request): string | null {
  return extractCookieValue(request, REFRESH_TOKEN_COOKIE);
}

export function resolveIncomingRefreshToken(
  request: Request,
  bodyToken?: string,
): string | null {
  if (typeof bodyToken === 'string' && bodyToken.length > 0) {
    return bodyToken;
  }

  return extractRefreshTokenFromCookie(request);
}

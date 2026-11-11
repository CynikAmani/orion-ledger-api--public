import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { assertAllowedOrigin, normalizeOrigin } from './allowed-origins.util';

type OriginRequest = Pick<Request, 'headers' | 'query'>;

function firstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }

  return undefined;
}

/**
 * Reads the caller frontend origin from the incoming request.
 * Priority: Origin header, `origin` query (OAuth start), Referer.
 * Does not read FRONTEND_BASE_URL — that env var is only an allowlist subscriber.
 */
export function extractRequestOriginCandidate(
  request: OriginRequest,
): string | null {
  const originHeader = firstHeaderValue(request.headers.origin);
  if (originHeader) {
    const normalized = normalizeOrigin(originHeader);
    if (normalized) {
      return normalized;
    }
  }

  const queryOrigin = firstQueryValue(request.query?.origin);
  if (queryOrigin) {
    const normalized = normalizeOrigin(queryOrigin);
    if (normalized) {
      return normalized;
    }
  }

  const referer = firstHeaderValue(request.headers.referer);
  if (referer) {
    return normalizeOrigin(referer);
  }

  return null;
}

/** Validates the request origin against ALLOWED_ORIGINS (and other subscribers). */
export function resolveRequestOrigin(
  request: OriginRequest,
  allowedOrigins: readonly string[],
): string {
  const candidate = extractRequestOriginCandidate(request);

  if (!candidate) {
    throw new BadRequestException(
      'Unable to resolve frontend origin from the request',
    );
  }

  return assertAllowedOrigin(candidate, allowedOrigins);
}

/**
 * Google callback carries the original frontend origin in OAuth `state`.
 * Prefer state; otherwise fall back to request headers/query.
 */
export function resolveOauthFrontendOrigin(
  state: unknown,
  request: OriginRequest,
  allowedOrigins: readonly string[],
): string {
  if (typeof state === 'string' && state.trim().length > 0) {
    return assertAllowedOrigin(state, allowedOrigins);
  }

  return resolveRequestOrigin(request, allowedOrigins);
}

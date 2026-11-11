import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { CONFIG_KEYS } from './config.keys';
import type { EnvironmentVariables } from './environment-variables.interface';

/**
 * Browser origins allowed for CORS, OAuth redirects, and email-link hosts.
 * Values must be full origins (scheme + host [+ port]), e.g. https://www.example.com
 *
 * ALLOWED_ORIGINS (plus FRONTEND_BASE_URL as an extra subscriber) is the allowlist
 * only. User-facing links are built from the incoming request origin, never from
 * FRONTEND_BASE_URL as the URL host.
 */

export function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return `${url.protocol}//${url.host}`.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function resolveAllowedOrigins(
  allowedOriginsCsv: string,
  frontendBaseUrl: string,
): string[] {
  const origins = new Set<string>();

  const add = (raw: string): void => {
    const normalized = normalizeOrigin(raw);
    if (normalized) {
      origins.add(normalized);
    }
  };

  add(frontendBaseUrl);

  for (const part of allowedOriginsCsv.split(',')) {
    add(part);
  }

  return [...origins];
}

export function getAllowedOriginsFromConfig(
  configService: ConfigService<EnvironmentVariables>,
): string[] {
  return resolveAllowedOrigins(
    configService.getOrThrow(CONFIG_KEYS.ALLOWED_ORIGINS, { infer: true }),
    configService.getOrThrow(CONFIG_KEYS.FRONTEND_BASE_URL, { infer: true }),
  );
}

export function isOriginAllowed(
  candidate: string,
  allowedOrigins: readonly string[],
): boolean {
  const normalized = normalizeOrigin(candidate);
  return normalized !== null && allowedOrigins.includes(normalized);
}

/** Normalizes and validates; throws ForbiddenException when not allowlisted. */
export function assertAllowedOrigin(
  candidate: string,
  allowedOrigins: readonly string[],
): string {
  const normalized = normalizeOrigin(candidate);

  if (!normalized || !allowedOrigins.includes(normalized)) {
    throw new ForbiddenException('Origin is not allowed');
  }

  return normalized;
}

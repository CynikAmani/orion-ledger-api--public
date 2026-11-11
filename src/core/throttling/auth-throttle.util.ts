import type { ExecutionContext } from '@nestjs/common';

const AUTH_SENSITIVE_PATH_SUFFIXES = [
  '/auth/login',
  '/auth/signup',
  '/auth/verify-mfa',
  '/auth/resend-mfa',
  '/auth/password-reset/request',
  '/auth/password-reset/verify',
  '/auth/password-reset/confirm',
  '/auth/account-access/validate',
  '/auth/account-access/set-password',
  '/sandbox/sessions',
] as const;

/** 5 attempts per 15 minutes for identity-targeted auth abuse */
export const AUTH_THROTTLE = {
  name: 'auth',
  limit: 5,
  ttl: 15 * 60 * 1000,
} as const;

export function extractAuthThrottleIdentity(body: unknown): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'anonymous';
  }

  const record = body as Record<string, unknown>;
  const raw =
    record.identity ??
    record.email ??
    record.mfaToken ??
    record.userId ??
    'anonymous';

  const normalized = String(raw).trim().toLowerCase();
  return normalized.length > 0 ? normalized : 'anonymous';
}

export function buildAuthThrottleTracker(req: Record<string, unknown>): string {
  const ips = req.ips;
  const ipFromProxy =
    Array.isArray(ips) && typeof ips[0] === 'string' ? ips[0] : undefined;
  const ip =
    ipFromProxy ??
    (typeof req.ip === 'string' ? req.ip : undefined) ??
    'unknown';

  return `${ip}:${extractAuthThrottleIdentity(req.body)}`;
}

export function isAuthSensitivePath(path: string): boolean {
  const normalized = path.split('?')[0] ?? '';
  return AUTH_SENSITIVE_PATH_SUFFIXES.some((suffix) =>
    normalized.endsWith(suffix),
  );
}

export function shouldSkipAuthThrottle(context: ExecutionContext): boolean {
  const request = context.switchToHttp().getRequest<{
    path?: string;
    url?: string;
    originalUrl?: string;
  }>();
  const path = request.path ?? request.originalUrl ?? request.url ?? '';
  return !isAuthSensitivePath(path);
}

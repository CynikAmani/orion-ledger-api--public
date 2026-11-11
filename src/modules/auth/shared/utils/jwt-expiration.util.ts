/**
 * Access-token lifetime. JwtModule, signAsync, and the access cookie must
 * all read the same JWT_EXPIRATION_TIME value (e.g. 3600s, 15m, 1h).
 *
 * A numeric value is seconds, matching jsonwebtoken.
 */
const DEFAULT_JWT_EXPIRES_IN = '3600s';

const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function resolveJwtExpiresIn(
  raw: string | number | undefined | null,
): string | number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return raw;
  }

  if (typeof raw !== 'string') {
    return DEFAULT_JWT_EXPIRES_IN;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return DEFAULT_JWT_EXPIRES_IN;
  }

  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return seconds > 0 ? seconds : DEFAULT_JWT_EXPIRES_IN;
  }

  const compact = trimmed.replace(/\s+/g, '');
  if (/^\d+(?:\.\d+)?(ms|s|m|h|d)$/i.test(compact)) {
    return compact;
  }

  return DEFAULT_JWT_EXPIRES_IN;
}

export function jwtExpiresInToMs(expiresIn: string | number): number {
  if (typeof expiresIn === 'number') {
    return expiresIn * 1000;
  }

  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/i.exec(expiresIn.trim());
  if (!match) {
    return jwtExpiresInToMs(DEFAULT_JWT_EXPIRES_IN);
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  return amount * UNIT_MS[unit];
}

export function accessTokenTtlMsFromEnv(): number {
  return jwtExpiresInToMs(resolveJwtExpiresIn(process.env.JWT_EXPIRATION_TIME));
}

/**
 * Access-token lifetime that ends at `expiresAt` and never exceeds the
 * configured JWT lifetime.
 */
export function cappedAccessTtlSeconds(
  expiresAt: Date,
  now = Date.now(),
): number {
  const configured = Math.max(1, Math.floor(accessTokenTtlMsFromEnv() / 1000));
  const remaining = Math.floor((expiresAt.getTime() - now) / 1000);

  if (remaining <= 0) {
    return 1;
  }

  return Math.min(configured, remaining);
}

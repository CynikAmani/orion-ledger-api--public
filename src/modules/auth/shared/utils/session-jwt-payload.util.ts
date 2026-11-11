/**
 * Session access-token claims.
 *
 * ABSOLUTE CONTRACT: the signed payload may contain only `id` (stable User PK)
 * plus standard JWT claims (`sub`, `iat`, `exp`). Roles, permissions, tenant IDs,
 * the public handle (`userId`), and user metadata must never be written into the token.
 *
 * Purpose-bound tokens (MFA, account-access) are a different contract and
 * must include `purpose`. Session validation rejects any token that has it.
 */
export interface SessionJwtClaims {
  id: number;
}

export interface SessionJwtPayload extends SessionJwtClaims {
  sub: string;
  iat?: number;
  exp?: number;
}

export interface DecodedAccessToken {
  id?: unknown;
  sub?: unknown;
  purpose?: unknown;
  iat?: number;
  exp?: number;
}

export function buildSessionJwtClaims(id: number): SessionJwtClaims {
  return { id };
}

export function resolveSessionUserPk(
  payload: DecodedAccessToken,
): number | null {
  if (payload.purpose !== undefined && payload.purpose !== null) {
    return null;
  }

  if (typeof payload.id === 'number' && Number.isInteger(payload.id) && payload.id > 0) {
    return payload.id;
  }

  if (typeof payload.sub === 'string' && payload.sub.length > 0) {
    const parsed = Number(payload.sub);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

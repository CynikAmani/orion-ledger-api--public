import { describe, expect, it } from '@jest/globals';
import {
  buildSessionJwtClaims,
  resolveSessionUserPk,
} from './session-jwt-payload.util';

describe('session JWT payload contract', () => {
  it('signs only id — no roles, permissions, tenants, or metadata', () => {
    const claims = buildSessionJwtClaims(1);

    expect(claims).toEqual({ id: 1 });
    expect(Object.keys(claims)).toEqual(['id']);
  });

  it('resolves id from the named claim, falling back to sub for legacy tokens', () => {
    expect(resolveSessionUserPk({ id: 1, sub: '2' })).toBe(1);
    expect(resolveSessionUserPk({ sub: '3' })).toBe(3);
  });

  it('rejects purpose-bound tokens (MFA / account-access)', () => {
    expect(
      resolveSessionUserPk({
        sub: '1',
        purpose: 'account-access',
      }),
    ).toBeNull();
    expect(
      resolveSessionUserPk({
        id: 1,
        purpose: 'mfa',
      }),
    ).toBeNull();
  });

  it('never reads roles, permissions, or tenant IDs from the token', () => {
    const id = resolveSessionUserPk({
      id: 1,
      sub: '1',
      roles: ['SUPER_ADMIN'],
      permissions: ['platform:users:delete'],
      tenantId: 'tenant-x',
    } as never);

    expect(id).toBe(1);
  });
});

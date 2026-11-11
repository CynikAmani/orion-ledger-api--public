import { describe, expect, it } from '@jest/globals';
import {
  buildAuthThrottleTracker,
  extractAuthThrottleIdentity,
  isAuthSensitivePath,
} from './auth-throttle.util';

describe('auth identity throttle tracker', () => {
  it('builds tracker as IP + target identity', () => {
    expect(
      buildAuthThrottleTracker({
        ip: '203.0.113.10',
        body: { identity: 'Alice@Example.com' },
      }),
    ).toBe('203.0.113.10:alice@example.com');
  });

  it('prefers proxy IP list when present', () => {
    expect(
      buildAuthThrottleTracker({
        ip: '10.0.0.1',
        ips: ['198.51.100.20', '10.0.0.1'],
        body: { identity: 'user-1' },
      }),
    ).toBe('198.51.100.20:user-1');
  });

  it('extracts MFA token and userId identifiers', () => {
    expect(extractAuthThrottleIdentity({ mfaToken: 'abc.def' })).toBe(
      'abc.def',
    );
    expect(extractAuthThrottleIdentity({ userId: 'staff-1' })).toBe('staff-1');
  });

  it('marks sensitive auth paths for the auth throttler', () => {
    expect(isAuthSensitivePath('/auth/login')).toBe(true);
    expect(isAuthSensitivePath('/api/auth/password-reset/verify')).toBe(true);
    expect(isAuthSensitivePath('/auth/verify-mfa')).toBe(true);
    expect(isAuthSensitivePath('/api/v1/sandbox/sessions')).toBe(true);
    expect(isAuthSensitivePath('/auth/refresh')).toBe(false);
    expect(isAuthSensitivePath('/admin/user')).toBe(false);
    expect(isAuthSensitivePath('/me/profile')).toBe(false);
  });
});

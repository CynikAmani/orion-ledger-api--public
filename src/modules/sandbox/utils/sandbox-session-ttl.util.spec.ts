import { describe, expect, it } from '@jest/globals';
import {
  SANDBOX_SESSION_TTL_MS,
  sandboxSessionExpiresAt,
} from './sandbox-session-ttl.util';

describe('sandboxSessionExpiresAt', () => {
  it('sets the visit ceiling one hour ahead', () => {
    const now = Date.parse('2026-11-07T12:00:00.000Z');
    expect(sandboxSessionExpiresAt(now).toISOString()).toBe(
      '2026-11-07T13:00:00.000Z',
    );
    expect(SANDBOX_SESSION_TTL_MS).toBe(60 * 60 * 1000);
  });
});

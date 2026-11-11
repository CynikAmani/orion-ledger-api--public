import { describe, expect, it } from '@jest/globals';
import { resolveAnnouncementLifecycle } from './announcement-lifecycle.constant';

describe('resolveAnnouncementLifecycle', () => {
  const startsAt = new Date('2026-08-01T00:00:00.000Z');
  const endsAt = new Date('2026-08-31T00:00:00.000Z');

  it('returns upcoming before startsAt', () => {
    expect(
      resolveAnnouncementLifecycle(
        startsAt,
        endsAt,
        new Date('2026-07-31T23:59:59.000Z'),
      ),
    ).toBe('upcoming');
  });

  it('returns running at startsAt and endsAt bounds', () => {
    expect(resolveAnnouncementLifecycle(startsAt, endsAt, startsAt)).toBe(
      'running',
    );
    expect(resolveAnnouncementLifecycle(startsAt, endsAt, endsAt)).toBe(
      'running',
    );
  });

  it('returns expired after endsAt', () => {
    expect(
      resolveAnnouncementLifecycle(
        startsAt,
        endsAt,
        new Date('2026-08-31T00:00:01.000Z'),
      ),
    ).toBe('expired');
  });
});

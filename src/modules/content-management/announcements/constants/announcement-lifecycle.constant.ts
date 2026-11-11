/** Derived row state from startsAt / endsAt. Never stored. */
export const ANNOUNCEMENT_LIFECYCLE_STATUSES = [
  'upcoming',
  'running',
  'expired',
] as const;

export type AnnouncementLifecycleStatus =
  (typeof ANNOUNCEMENT_LIFECYCLE_STATUSES)[number];

/**
 * Admin list filters.
 * - upcoming: startsAt is in the future
 * - running: currently inside the window
 * - expired: endsAt is in the past
 */
export const ANNOUNCEMENT_LIST_STATUSES = [
  'running',
  'expired',
  'upcoming',
] as const;

export type AnnouncementListStatus =
  (typeof ANNOUNCEMENT_LIST_STATUSES)[number];

export function resolveAnnouncementLifecycle(
  startsAt: Date,
  endsAt: Date,
  now: Date = new Date(),
): AnnouncementLifecycleStatus {
  const at = now.getTime();

  if (at < startsAt.getTime()) {
    return 'upcoming';
  }

  if (at > endsAt.getTime()) {
    return 'expired';
  }

  return 'running';
}

const DAY_MS = 86_400_000;

export type TenantAccessState = 'TRIAL' | 'PAID' | 'EXPIRED';

export type SubscriptionTimelinePhase = 'upcoming' | 'active' | 'past';

export interface OpenSubscriptionWindow {
  startsAt: Date;
  endsAt: Date;
}

export interface ResolvedTenantAccess {
  accessState: TenantAccessState;
  onTrial: boolean;
  daysRemaining: number | null;
  accessStartsAt: Date | null;
  accessEndsAt: Date | null;
}

/**
 * Whole days until access ends. A partial day still counts as one day.
 * Null when the end is open-ended, such as a trial with no expiry.
 */
export function wholeDaysRemaining(
  now: Date,
  endsAt: Date | null,
): number | null {
  if (!endsAt) {
    return null;
  }

  const remainingMs = endsAt.getTime() - now.getTime();
  if (remainingMs <= 0) {
    return 0;
  }

  return Math.ceil(remainingMs / DAY_MS);
}

/**
 * Paid coverage wins over a trial flag. Open windows may be stacked;
 * access then runs until the furthest endsAt. A trial with no trialEndsAt
 * stays open. Anything else is expired.
 */
export function resolveTenantSubscriptionAccess(input: {
  now: Date;
  subscriptionStatus: 'TRIAL' | 'PAID' | 'EXPIRED';
  trialEndsAt: Date | null;
  openWindows: OpenSubscriptionWindow[];
}): ResolvedTenantAccess {
  const covering = input.openWindows.filter(
    (window) => window.startsAt <= input.now && window.endsAt > input.now,
  );

  if (covering.length > 0) {
    const current = covering.reduce((latest, window) =>
      window.startsAt >= latest.startsAt ? window : latest,
    );
    const accessEndsAt = input.openWindows.reduce(
      (latest, window) => (window.endsAt > latest ? window.endsAt : latest),
      current.endsAt,
    );

    return {
      accessState: 'PAID',
      onTrial: false,
      daysRemaining: wholeDaysRemaining(input.now, accessEndsAt),
      accessStartsAt: current.startsAt,
      accessEndsAt,
    };
  }

  const trialOpen =
    input.subscriptionStatus === 'TRIAL' &&
    (input.trialEndsAt === null || input.trialEndsAt > input.now);

  if (trialOpen) {
    return {
      accessState: 'TRIAL',
      onTrial: true,
      daysRemaining: wholeDaysRemaining(input.now, input.trialEndsAt),
      accessStartsAt: null,
      accessEndsAt: input.trialEndsAt,
    };
  }

  return {
    accessState: 'EXPIRED',
    onTrial: false,
    daysRemaining: 0,
    accessStartsAt: null,
    accessEndsAt: null,
  };
}

/**
 * Paid coverage wins while its stored end is still ahead.
 * Otherwise an open trial is allowed. A lapsed paid window does not fall back to trial.
 */
export function tenantSubscriptionAllowsRequests(input: {
  now: Date;
  subscriptionStatus: 'TRIAL' | 'PAID' | 'EXPIRED';
  trialEndsAt: Date | null;
  subscriptionAccessEndsAt: Date | null;
}): boolean {
  if (
    input.subscriptionAccessEndsAt !== null &&
    input.subscriptionAccessEndsAt > input.now
  ) {
    return true;
  }

  return (
    input.subscriptionStatus === 'TRIAL' &&
    (input.trialEndsAt === null || input.trialEndsAt > input.now)
  );
}

export function subscriptionTimelinePhase(
  now: Date,
  startsAt: Date,
  endsAt: Date,
): SubscriptionTimelinePhase {
  if (now < startsAt) {
    return 'upcoming';
  }

  if (now < endsAt) {
    return 'active';
  }

  return 'past';
}

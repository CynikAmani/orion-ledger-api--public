export function timestampToSeconds(date: Date): Date {
  const value = new Date(date.getTime());
  value.setUTCMilliseconds(0);
  return value;
}

export function addDurationInDays(start: Date, durationInDays: number): Date {
  const end = timestampToSeconds(start);
  end.setUTCDate(end.getUTCDate() + durationInDays);
  return end;
}

/**
 * A new paid window starts when the current open window ends.
 * After expiry, the next window starts at the payment time.
 */
export function resolveSubscriptionWindow(input: {
  now: Date;
  durationInDays: number;
  openCoverageEndsAt: Date | null;
}): { startsAt: Date; endsAt: Date } {
  const now = timestampToSeconds(input.now);
  const openEndsAt = input.openCoverageEndsAt
    ? timestampToSeconds(input.openCoverageEndsAt)
    : null;
  const startsAt = openEndsAt && openEndsAt > now ? openEndsAt : now;

  return {
    startsAt,
    endsAt: addDurationInDays(startsAt, input.durationInDays),
  };
}

/**
 * Half-open coverage. A grant that starts when another ends does not overlap.
 */
export function subscriptionWindowsOverlap(
  left: { startsAt: Date; endsAt: Date },
  right: { startsAt: Date; endsAt: Date },
): boolean {
  return left.startsAt < right.endsAt && right.startsAt < left.endsAt;
}

/**
 * Start of the next grant. Walks the chain that already covers `now`
 * and stops at the first gap, so a removed future grant leaves a slot.
 */
export function nextScheduledStart(
  now: Date,
  windows: Array<{ startsAt: Date; endsAt: Date }>,
): Date {
  let cursor = timestampToSeconds(now);
  const pending = windows.map((window) => ({
    startsAt: timestampToSeconds(window.startsAt),
    endsAt: timestampToSeconds(window.endsAt),
  }));

  let advanced = true;
  while (advanced) {
    advanced = false;
    for (const window of pending) {
      if (window.startsAt <= cursor && window.endsAt > cursor) {
        cursor = window.endsAt;
        advanced = true;
      }
    }
  }

  return cursor;
}

export function canRemovePlatformSubscription(input: {
  now: Date;
  startsAt: Date;
  paymentMethod: string | null;
}): boolean {
  return (
    (input.paymentMethod === 'MANUAL_CASH' ||
      input.paymentMethod === 'ELECTRONIC_FUNDS_TRANSFER') &&
    input.now < input.startsAt
  );
}

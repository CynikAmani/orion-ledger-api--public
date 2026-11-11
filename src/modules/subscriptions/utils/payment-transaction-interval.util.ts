export const PAYMENT_TRANSACTION_INTERVALS = [
  'THIS_MONTH',
  'THIS_YEAR',
  'ALL_TIME',
] as const;

export type PaymentTransactionInterval =
  (typeof PAYMENT_TRANSACTION_INTERVALS)[number];

/** Malawi has no daylight saving. Calendar months are UTC+2. */
const BLANTYRE_OFFSET_MS = 2 * 60 * 60 * 1000;

export function paymentTransactionIntervalWindow(
  interval: PaymentTransactionInterval,
  now: Date,
): { startsAt: Date | null; endsAt: Date } {
  if (interval === 'ALL_TIME') {
    return { startsAt: null, endsAt: now };
  }

  const local = new Date(now.getTime() + BLANTYRE_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = interval === 'THIS_YEAR' ? 0 : local.getUTCMonth();
  const startsAt = new Date(Date.UTC(year, month, 1) - BLANTYRE_OFFSET_MS);

  return { startsAt, endsAt: now };
}

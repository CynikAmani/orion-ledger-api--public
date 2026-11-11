const DEFAULT_LOCALE = 'en-MW';
const DEFAULT_CURRENCY = 'MWK';

/**
 * Currency formatting for user-facing copy (emails, in-app notifications).
 */
export function formatCurrency(
  amount: number,
  options?: { locale?: string; currency?: string },
): string {
  return new Intl.NumberFormat(options?.locale ?? DEFAULT_LOCALE, {
    style: 'currency',
    currency: options?.currency ?? DEFAULT_CURRENCY,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Whole-number share of total due, clamped 0–100. Example: "37%" */
export function formatPaidPercent(
  amountPaid: number,
  totalDue: number,
): string {
  if (totalDue <= 0) {
    return '0%';
  }

  const percent = Math.round((amountPaid / totalDue) * 100);
  return `${Math.min(100, Math.max(0, percent))}%`;
}

export function formatDurationWeeks(weeks: number): string {
  return weeks === 1 ? '1 week' : `${weeks} weeks`;
}

const DEFAULT_TIME_ZONE = 'Africa/Blantyre';
const DEFAULT_LOCALE = 'en-GB';

export type FormatDateInput = Date | string | number;

export interface UtcDateWindow {
  start: Date;
  endExclusive: Date;
}

function toDate(value: FormatDateInput): Date {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${String(value)}`);
  }

  return date;
}

function padUtc(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Human-readable date + time for user-facing copy (notifications, emails, etc.).
 * Example: "26 Aug 2026, 14:53"
 */
export function formatDisplayDateTime(
  value: FormatDateInput,
  options?: { timeZone?: string; locale?: string },
): string {
  return new Intl.DateTimeFormat(options?.locale ?? DEFAULT_LOCALE, {
    timeZone: options?.timeZone ?? DEFAULT_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(toDate(value));
}

/**
 * Human-readable date only.
 * Example: "26 Aug 2026"
 */
export function formatDisplayDate(
  value: FormatDateInput,
  options?: { timeZone?: string; locale?: string },
): string {
  return new Intl.DateTimeFormat(options?.locale ?? DEFAULT_LOCALE, {
    timeZone: options?.timeZone ?? DEFAULT_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(toDate(value));
}

/** UTC calendar day as YYYY-MM-DD (chart/series keys). */
export function utcDayLabel(date: Date): string {
  return `${date.getUTCFullYear()}-${padUtc(date.getUTCMonth() + 1)}-${padUtc(date.getUTCDate())}`;
}

/** UTC calendar month as YYYY-MM (chart/series keys). */
export function utcMonthLabel(date: Date): string {
  return `${date.getUTCFullYear()}-${padUtc(date.getUTCMonth() + 1)}`;
}

/** UTC midnight of the calendar day. */
export function utcDayStart(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/** UTC midnight of the first day of the calendar month containing `date`. */
export function utcMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function addUtcMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
}

/** Inclusive-start / exclusive-end UTC window for a calendar month (`month` is 1–12). */
export function utcMonthWindow(year: number, month: number): UtcDateWindow {
  const start = new Date(Date.UTC(year, month - 1, 1));
  return { start, endExclusive: addUtcMonths(start, 1) };
}

/** Inclusive-start / exclusive-end UTC window for a calendar year. */
export function utcYearWindow(year: number): UtcDateWindow {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    endExclusive: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

/** Inclusive-start / exclusive-end UTC window for the calendar month of `now`. */
export function utcCurrentMonthWindow(now: Date = new Date()): UtcDateWindow {
  const start = utcMonthStart(now);
  return { start, endExclusive: addUtcMonths(start, 1) };
}

const UTC_MONTH_SHORT_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** UTC month short label (Jan–Dec) for chart axes. */
export function utcMonthShortLabel(date: Date): string {
  return UTC_MONTH_SHORT_LABELS[date.getUTCMonth()];
}

export function utcMonthShortLabelFromIndex(monthIndex0: number): string {
  return UTC_MONTH_SHORT_LABELS[monthIndex0];
}

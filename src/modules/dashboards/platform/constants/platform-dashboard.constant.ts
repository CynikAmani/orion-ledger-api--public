import {
  utcCurrentMonthWindow,
  utcYearWindow,
  type UtcDateWindow,
} from '../../../../common/utils/format-date.util';

export const PLATFORM_DASHBOARD_TIMEFRAMES = [
  'this_month',
  'this_year',
  'all_time',
] as const;

export type PlatformDashboardTimeframe =
  (typeof PLATFORM_DASHBOARD_TIMEFRAMES)[number];

export const PLATFORM_DASHBOARD_DEFAULT_TIMEFRAME: PlatformDashboardTimeframe =
  'this_month';

export const PLATFORM_DASHBOARD_RANKING_LIMITS = [5, 10, 25] as const;

export type PlatformDashboardRankingLimit =
  (typeof PLATFORM_DASHBOARD_RANKING_LIMITS)[number];

export const PLATFORM_DASHBOARD_DEFAULT_RANKING_LIMIT: PlatformDashboardRankingLimit = 5;

/**
 * UTC inclusive-start / exclusive-end window for volume + ranking filters.
 * `all_time` returns null (omit date predicates).
 */
export function resolvePlatformTimeframeWindow(
  timeframe: PlatformDashboardTimeframe,
  now: Date = new Date(),
): UtcDateWindow | null {
  if (timeframe === 'all_time') {
    return null;
  }

  if (timeframe === 'this_month') {
    return utcCurrentMonthWindow(now);
  }

  return utcYearWindow(now.getUTCFullYear());
}

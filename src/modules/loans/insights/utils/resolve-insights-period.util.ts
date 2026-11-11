import { BadRequestException } from '@nestjs/common';
import {
  utcCurrentMonthWindow,
  utcMonthStart,
  utcMonthWindow,
  utcYearWindow,
} from '../../../../common/utils/format-date.util';
import type { LoanPeriodWindow } from '../../shared/types/loan-period-window';
import type { LoanInsightsQueryDto } from '../dto/insights-query.dto';

export interface InsightsFilterResolution {
  calendarYear: number;
  calendarMonth: number | null;
  dailyWindow: LoanPeriodWindow | null;
  annualWindow: LoanPeriodWindow;
}

/**
 * Always returns an annual window. Daily window is set when a month is known
 * (explicit month+year, or default current UTC month).
 */
export function resolveInsightsFilter(
  query: LoanInsightsQueryDto,
  now: Date = new Date(),
): InsightsFilterResolution {
  if (query.month != null && query.year == null) {
    throw new BadRequestException('month requires year');
  }

  if (query.month != null && query.year != null) {
    return {
      calendarYear: query.year,
      calendarMonth: query.month,
      dailyWindow: utcMonthWindow(query.year, query.month),
      annualWindow: utcYearWindow(query.year),
    };
  }

  if (query.year != null) {
    return {
      calendarYear: query.year,
      calendarMonth: null,
      dailyWindow: null,
      annualWindow: utcYearWindow(query.year),
    };
  }

  const current = utcMonthStart(now);
  const calendarYear = current.getUTCFullYear();
  const calendarMonth = current.getUTCMonth() + 1;

  return {
    calendarYear,
    calendarMonth,
    dailyWindow: utcCurrentMonthWindow(now),
    annualWindow: utcYearWindow(calendarYear),
  };
}

import { BadRequestException } from '@nestjs/common';
import {
  addUtcDays,
  utcCurrentMonthWindow,
  utcDayStart,
  utcMonthWindow,
  utcYearWindow,
} from '../../../../common/utils/format-date.util';
import type { LoanPeriodWindow } from '../../shared/types/loan-period-window';
import type { ReportQueryDto } from '../dto/report-query.dto';

function assertChronological(window: LoanPeriodWindow): LoanPeriodWindow {
  if (window.start >= window.endExclusive) {
    throw new BadRequestException(
      'The report period start must be before the period end',
    );
  }

  return window;
}

/**
 * Resolves query filters into an inclusive-start / exclusive-end UTC window.
 * Default (no filters) is the current UTC calendar month.
 */
export function resolveReportWindow(query: ReportQueryDto): LoanPeriodWindow {
  const hasStart = query.startDate != null;
  const hasEnd = query.endDate != null;
  const hasMonth = query.month != null;
  const hasYear = query.year != null;

  if ((hasMonth || hasYear) && (hasStart || hasEnd)) {
    throw new BadRequestException(
      'Use either startDate/endDate or month/year, not both',
    );
  }

  if (hasMonth && !hasYear) {
    throw new BadRequestException('month requires year');
  }

  if (hasEnd && !hasStart) {
    throw new BadRequestException('endDate requires startDate');
  }

  if (hasMonth && hasYear) {
    return assertChronological(utcMonthWindow(query.year!, query.month!));
  }

  if (hasYear) {
    return assertChronological(utcYearWindow(query.year!));
  }

  if (hasStart && hasEnd) {
    const start = utcDayStart(query.startDate!);
    return assertChronological({
      start,
      endExclusive: addUtcDays(utcDayStart(query.endDate!), 1),
    });
  }

  if (hasStart) {
    return assertChronological({
      start: utcDayStart(query.startDate!),
      endExclusive: new Date(),
    });
  }

  return utcCurrentMonthWindow();
}

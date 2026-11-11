import { Prisma } from '@prisma/client';
import { LOAN_STATUSES } from '../constants/loan-status.constant';

const END_DATE_LIST_STATUSES = new Set<string>([
  LOAN_STATUSES.ACTIVE,
  LOAN_STATUSES.OVERDUE,
  LOAN_STATUSES.DEFAULTED,
]);

/**
 * Staff and customer loan-record lists.
 *
 * ACTIVE: nearest due first (endDate closest to today among remaining terms).
 * OVERDUE / DEFAULTED: oldest first (earliest endDate), newest last.
 * CLEARED and unfiltered mixed lists keep newest startDate first.
 */
export function loanRecordListOrderBy(
  status?: string,
): Prisma.LoanOrderByWithRelationInput[] {
  if (status && END_DATE_LIST_STATUSES.has(status)) {
    return [{ endDate: 'asc' }, { loanId: 'asc' }];
  }

  return [{ startDate: 'desc' }, { loanId: 'desc' }];
}

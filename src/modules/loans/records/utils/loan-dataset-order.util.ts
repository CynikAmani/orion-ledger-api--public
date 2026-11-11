import { LOAN_STATUSES } from '../constants/loan-status.constant';

const STATUS_RANK: Record<string, number> = {
  [LOAN_STATUSES.ACTIVE]: 0,
  [LOAN_STATUSES.OVERDUE]: 1,
  [LOAN_STATUSES.DEFAULTED]: 2,
  [LOAN_STATUSES.CLEARED]: 3,
};

export interface LoanDatasetSortRow {
  reference: string;
  status: string;
  startDate: Date;
  endDate: Date;
}

/** Group by status, then keep each group in the same date order as the loan list. */
export function compareLoanDatasetRows(
  left: LoanDatasetSortRow,
  right: LoanDatasetSortRow,
): number {
  const byStatus = statusRank(left.status) - statusRank(right.status);
  if (byStatus !== 0) {
    return byStatus;
  }

  if (left.status === LOAN_STATUSES.CLEARED) {
    const byStart = right.startDate.getTime() - left.startDate.getTime();
    if (byStart !== 0) {
      return byStart;
    }
  } else {
    const byEnd = left.endDate.getTime() - right.endDate.getTime();
    if (byEnd !== 0) {
      return byEnd;
    }
  }

  return left.reference.localeCompare(right.reference);
}

function statusRank(status: string): number {
  return STATUS_RANK[status] ?? Object.keys(STATUS_RANK).length;
}

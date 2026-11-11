import { describe, expect, it } from '@jest/globals';
import { LOAN_STATUSES } from '../constants/loan-status.constant';
import { loanRecordListOrderBy } from './loan-record-list-order.util';

describe('loanRecordListOrderBy', () => {
  it('sorts active loans by nearest due date first', () => {
    expect(loanRecordListOrderBy(LOAN_STATUSES.ACTIVE)).toEqual([
      { endDate: 'asc' },
      { loanId: 'asc' },
    ]);
  });

  it('sorts overdue loans oldest first', () => {
    expect(loanRecordListOrderBy(LOAN_STATUSES.OVERDUE)).toEqual([
      { endDate: 'asc' },
      { loanId: 'asc' },
    ]);
  });

  it('sorts defaulted loans oldest first', () => {
    expect(loanRecordListOrderBy(LOAN_STATUSES.DEFAULTED)).toEqual([
      { endDate: 'asc' },
      { loanId: 'asc' },
    ]);
  });

  it('keeps newest-first startDate for cleared loans', () => {
    expect(loanRecordListOrderBy(LOAN_STATUSES.CLEARED)).toEqual([
      { startDate: 'desc' },
      { loanId: 'desc' },
    ]);
  });

  it('keeps newest-first startDate when no status filter is set', () => {
    expect(loanRecordListOrderBy()).toEqual([
      { startDate: 'desc' },
      { loanId: 'desc' },
    ]);
  });
});

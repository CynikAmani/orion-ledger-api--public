export const LOAN_STATUSES = {
  ACTIVE: 'ACTIVE',
  OVERDUE: 'OVERDUE',
  DEFAULTED: 'DEFAULTED',
  CLEARED: 'CLEARED',
} as const;

export type LoanStatus = (typeof LOAN_STATUSES)[keyof typeof LOAN_STATUSES];

export const LOAN_STATUS_VALUES = Object.values(LOAN_STATUSES);

/** Statuses that keep a customer on operational hold. */
export const LOAN_BLOCKING_STATUSES: LoanStatus[] = [
  LOAN_STATUSES.OVERDUE,
  LOAN_STATUSES.DEFAULTED,
];

/** Staff may edit terms only while the loan is still collecting. */
export const LOAN_EDITABLE_STATUSES: LoanStatus[] = [
  LOAN_STATUSES.ACTIVE,
  LOAN_STATUSES.OVERDUE,
];

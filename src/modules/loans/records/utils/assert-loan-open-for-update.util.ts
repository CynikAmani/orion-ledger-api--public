import { BadRequestException } from '@nestjs/common';
import {
  LOAN_EDITABLE_STATUSES,
  type LoanStatus,
} from '../constants/loan-status.constant';

export function isLoanOpenForStaffUpdate(loan: {
  status: string;
  isCleared?: boolean | null;
}): boolean {
  if (loan.isCleared === true) {
    return false;
  }

  return LOAN_EDITABLE_STATUSES.includes(
    loan.status.toUpperCase() as LoanStatus,
  );
}

export function assertLoanOpenForStaffUpdate(loan: {
  status: string;
  isCleared?: boolean | null;
}): void {
  if (!isLoanOpenForStaffUpdate(loan)) {
    throw new BadRequestException(
      'Only active or overdue loans can be updated',
    );
  }
}

export function assertUpdatedReturnExceedsAmountPaid(
  returnAmount: number,
  amountPaid: number,
): void {
  if (amountPaid > 0 && returnAmount <= amountPaid) {
    throw new BadRequestException(
      'Updated return amount must exceed the amount already paid on this loan',
    );
  }
}

import {
  calculateLoanReturn,
  type OfferDiscountInput,
} from './calculate-loan-return.util';

export interface ApplicationRateSnapshot {
  loanTypeId: number;
  activeRate: number;
  interestRate: number;
  expectedReturnAmount: number;
}

/**
 * Freeze catalog + offer math onto an application at write time.
 * Approve/detail must use these values — never re-read InterestRate for money fields.
 */
export function buildApplicationRateSnapshot(params: {
  loanTypeId: number;
  activeRate: number;
  loanAmount: number;
  offer?: OfferDiscountInput | null;
}): ApplicationRateSnapshot {
  const { interestRate, returnAmount } = calculateLoanReturn({
    loanAmount: params.loanAmount,
    activeRate: params.activeRate,
    offer: params.offer,
  });

  return {
    loanTypeId: params.loanTypeId,
    activeRate: params.activeRate,
    interestRate,
    expectedReturnAmount: returnAmount,
  };
}

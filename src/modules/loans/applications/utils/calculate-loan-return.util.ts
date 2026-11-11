import { DiscountType } from '@prisma/client';

export interface OfferDiscountInput {
  discountType: DiscountType;
  discountValue: number;
}

export interface LoanReturnCalculation {
  /** Rate persisted on the loan record. */
  interestRate: number;
  returnAmount: number;
}

/**
 * PERCENTAGE: subtract discount points from activeRate (floor 0), then compute return.
 * FIXED_AMOUNT: compute return at activeRate, then subtract discount (floor = loanAmount).
 */
export function calculateLoanReturn(params: {
  loanAmount: number;
  activeRate: number;
  offer?: OfferDiscountInput | null;
}): LoanReturnCalculation {
  const { loanAmount, activeRate, offer } = params;

  if (!offer) {
    return {
      interestRate: activeRate,
      returnAmount: Math.round(loanAmount * (1 + activeRate / 100)),
    };
  }

  if (offer.discountType === DiscountType.PERCENTAGE) {
    const interestRate = Math.max(0, activeRate - offer.discountValue);
    return {
      interestRate,
      returnAmount: Math.round(loanAmount * (1 + interestRate / 100)),
    };
  }

  const baseReturn = Math.round(loanAmount * (1 + activeRate / 100));
  const discountAmount = Math.round(offer.discountValue);

  return {
    interestRate: activeRate,
    returnAmount: Math.max(loanAmount, baseReturn - discountAmount),
  };
}

/**
 * Split cash paid against a loan contract. Principal is pro-rata
 * loanAmount/returnAmount; remainder is interest. No penalty component in schema.
 */
export function allocatePaidToPrincipalAndInterest(params: {
  amountPaid: number;
  loanAmount: number;
  returnAmount: number;
}): { principalPaid: number; interestPaid: number } {
  const { amountPaid, loanAmount, returnAmount } = params;

  if (amountPaid <= 0) {
    return { principalPaid: 0, interestPaid: 0 };
  }

  if (returnAmount <= 0) {
    return { principalPaid: amountPaid, interestPaid: 0 };
  }

  const principalPaid = Math.min(
    amountPaid,
    Math.max(0, Math.round((amountPaid * loanAmount) / returnAmount)),
  );

  return { principalPaid, interestPaid: amountPaid - principalPaid };
}

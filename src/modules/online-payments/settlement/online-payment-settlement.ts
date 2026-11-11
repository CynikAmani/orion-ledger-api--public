import type { VerifiedPayment } from '../interfaces/payment-provider-client.interface';

export const ONLINE_PAYMENT_SETTLEMENT = Symbol('ONLINE_PAYMENT_SETTLEMENT');

export type OnlinePaymentApplyOutcome =
  | 'settled'
  | 'already_settled'
  | 'pending'
  | 'failed'
  | 'cancelled'
  | 'not_found'
  | 'mismatch';

export interface AppliedOnlinePayment {
  outcome: OnlinePaymentApplyOutcome;
}

/**
 * Domain hook for a charge the provider has already verified.
 * Online payments does not decide what the charge buys.
 */
export interface OnlinePaymentSettlement {
  applyVerifiedPayment(
    verified: VerifiedPayment,
  ): Promise<AppliedOnlinePayment>;
}

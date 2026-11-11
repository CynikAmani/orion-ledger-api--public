import { Prisma } from '@prisma/client';
import type { VerifiedPayment } from '../../online-payments/interfaces/payment-provider-client.interface';
import { paymentAmountsMatch } from './payment-amount.util';

export function findPaymentVerificationMismatch(
  payment: {
    transactionReference: string;
    amount: Prisma.Decimal;
    currency: string;
  },
  verified: VerifiedPayment,
): string | null {
  if (verified.transactionReference !== payment.transactionReference) {
    return 'Verified transaction reference does not match the stored payment';
  }

  if (!paymentAmountsMatch(payment.amount, verified.amount)) {
    return 'Verified amount does not match the stored payment amount';
  }

  if (verified.currency.toUpperCase() !== payment.currency.toUpperCase()) {
    return 'Verified currency does not match the stored payment currency';
  }

  return null;
}

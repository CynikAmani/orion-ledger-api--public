import { PaymentMethod } from '@prisma/client';

/** Offline methods a platform operator can record. Online stays on tenant checkout. */
export const MANUAL_SUBSCRIPTION_PAYMENT_METHODS = [
  PaymentMethod.MANUAL_CASH,
  PaymentMethod.ELECTRONIC_FUNDS_TRANSFER,
] as const;

export type ManualSubscriptionPaymentMethod =
  (typeof MANUAL_SUBSCRIPTION_PAYMENT_METHODS)[number];

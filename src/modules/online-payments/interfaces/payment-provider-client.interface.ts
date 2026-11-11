export type VerifiedPaymentStatus =
  'success' | 'failed' | 'cancelled' | 'pending';

export interface VerifiedPayment {
  transactionReference: string;
  providerTransactionId: string | null;
  status: VerifiedPaymentStatus;
  amount: number;
  currency: string;
}

export interface InitializeCheckoutInput {
  transactionReference: string;
  /** Major units with two decimal places, for example "15000.00". */
  amount: string;
  currency: string;
  callbackUrl: string;
  returnUrl: string;
  customer: {
    email?: string | null;
    firstName?: string;
    lastName?: string;
  };
  description?: string;
}

export interface InitializedCheckout {
  transactionReference: string;
  checkoutUrl: string;
  providerTransactionId: string | null;
  /** Active credential mode that created the charge (`test` or `live`). */
  mode: string;
}

export interface PaymentProviderClient {
  initializeCheckout(
    input: InitializeCheckoutInput,
  ): Promise<InitializedCheckout>;
  verifyTransaction(transactionReference: string): Promise<VerifiedPayment>;
}

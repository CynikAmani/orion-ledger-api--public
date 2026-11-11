import {
  SUBSCRIPTION_PAYMENT_CALLBACK_PATH,
  SUBSCRIPTION_PAYMENT_RETURN_PATH,
} from '../constants/subscription-payment.constant';

export interface SubscriptionPaymentProviderUrls {
  callbackUrl: string;
  returnUrl: string;
}

export function buildSubscriptionPaymentProviderUrls(
  origin: string,
  transactionReference: string,
): SubscriptionPaymentProviderUrls {
  const base = origin.replace(/\/+$/, '');
  const txRef = encodeURIComponent(transactionReference);

  return {
    callbackUrl: `${base}${SUBSCRIPTION_PAYMENT_CALLBACK_PATH}?tx_ref=${txRef}`,
    returnUrl: `${base}${SUBSCRIPTION_PAYMENT_RETURN_PATH}?tx_ref=${txRef}`,
  };
}

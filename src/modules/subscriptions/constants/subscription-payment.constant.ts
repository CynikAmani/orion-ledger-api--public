/**
 * PayChangu browser routes. The host comes from the request origin, not a fixed domain.
 * Both pages receive `tx_ref` and must POST it to the checkout verify endpoint so the
 * attempt is settled with PayChangu instead of remaining pending.
 * Success lands on the callback path. Cancel and failure land on the return path.
 */
export const SUBSCRIPTION_PAYMENT_CALLBACK_PATH =
  '/app/subscription/checkout/callback';
export const SUBSCRIPTION_PAYMENT_RETURN_PATH =
  '/app/subscription/checkout/return';

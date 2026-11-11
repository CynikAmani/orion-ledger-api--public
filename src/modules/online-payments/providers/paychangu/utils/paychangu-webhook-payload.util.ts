import {
  PAYCHANGU_IGNORED_EVENT_TYPES,
  PAYCHANGU_PAYMENT_EVENT_TYPES,
} from '../constants/paychangu-event-types.constant';
import {
  isRecord,
  nestedRecord,
  readNumber,
  readString,
} from './paychangu-json.util';

export interface MappedPaychanguWebhook {
  eventType: string | null;
  transactionReference: string | null;
  providerTransactionId: string | null;
  status: string | null;
  amount: number | null;
  currency: string | null;
  mode: string | null;
}

export function parsePaychanguWebhookPayload(
  rawBody: string,
): Record<string, unknown> {
  const parsed: unknown = JSON.parse(rawBody);
  if (!isRecord(parsed)) {
    throw new Error('PayChangu webhook payload must be a JSON object');
  }
  return parsed;
}

export function mapPaychanguWebhookPayload(
  payload: Record<string, unknown>,
): MappedPaychanguWebhook {
  const nested = nestedRecord(payload, 'data');

  const transactionReference =
    readString(payload, 'tx_ref') ??
    (nested ? readString(nested, 'tx_ref') : null);

  const providerReference =
    readString(payload, 'reference') ??
    (nested ? readString(nested, 'reference') : null);

  const chargeId =
    readString(payload, 'charge_id') ??
    (nested ? readString(nested, 'charge_id') : null);

  return {
    eventType:
      readString(payload, 'event_type') ??
      (nested ? readString(nested, 'event_type') : null),
    transactionReference,
    providerTransactionId: providerReference ?? chargeId,
    status:
      readString(payload, 'status') ??
      (nested ? readString(nested, 'status') : null),
    amount:
      readNumber(payload, 'amount') ??
      (nested ? readNumber(nested, 'amount') : null),
    currency:
      readString(payload, 'currency') ??
      (nested ? readString(nested, 'currency') : null),
    mode:
      readString(payload, 'mode') ??
      (nested ? readString(nested, 'mode') : null),
  };
}

export function shouldIgnorePaychanguEvent(eventType: string | null): boolean {
  if (!eventType) {
    return false;
  }
  return PAYCHANGU_IGNORED_EVENT_TYPES.has(eventType);
}

export function isPaychanguPaymentEvent(eventType: string | null): boolean {
  if (!eventType) {
    return true;
  }
  return PAYCHANGU_PAYMENT_EVENT_TYPES.has(eventType);
}

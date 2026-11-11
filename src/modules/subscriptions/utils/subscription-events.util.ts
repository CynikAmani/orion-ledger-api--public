import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { SUBSCRIPTION_PAYMENT_AUDIT_ACTIONS } from '../constants/subscription-payment-audit-actions.constant';

export interface SubscriptionEventActor {
  id: number;
  fullname: string;
  email: string | null;
}

export const SUBSCRIPTION_PAYMENT_EVENT_TYPES = {
  INITIATED: 'INITIATED',
  CHECKOUT_FAILED: 'CHECKOUT_FAILED',
  VERIFICATION_MISMATCH: 'VERIFICATION_MISMATCH',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  SETTLED: 'SETTLED',
} as const;

export type SubscriptionPaymentEventType =
  (typeof SUBSCRIPTION_PAYMENT_EVENT_TYPES)[keyof typeof SUBSCRIPTION_PAYMENT_EVENT_TYPES];

/** One step on the payment that bought the subscription. */
export interface SubscriptionPaymentEventResponse {
  id: string;
  type: SubscriptionPaymentEventType;
  occurredAt: string;
  status: string | null;
  transactionReference: string | null;
  amount: string | null;
  currency: string | null;
  failureReason: string | null;
  actor: SubscriptionEventActor | null;
}

const EVENT_TYPE_BY_ACTION: Record<string, SubscriptionPaymentEventType> = {
  [SUBSCRIPTION_PAYMENT_AUDIT_ACTIONS.INITIATED]:
    SUBSCRIPTION_PAYMENT_EVENT_TYPES.INITIATED,
  [SUBSCRIPTION_PAYMENT_AUDIT_ACTIONS.CHECKOUT_FAILED]:
    SUBSCRIPTION_PAYMENT_EVENT_TYPES.CHECKOUT_FAILED,
  [SUBSCRIPTION_PAYMENT_AUDIT_ACTIONS.VERIFICATION_MISMATCH]:
    SUBSCRIPTION_PAYMENT_EVENT_TYPES.VERIFICATION_MISMATCH,
  [SUBSCRIPTION_PAYMENT_AUDIT_ACTIONS.FAILED]:
    SUBSCRIPTION_PAYMENT_EVENT_TYPES.FAILED,
  [SUBSCRIPTION_PAYMENT_AUDIT_ACTIONS.CANCELLED]:
    SUBSCRIPTION_PAYMENT_EVENT_TYPES.CANCELLED,
  [SUBSCRIPTION_PAYMENT_AUDIT_ACTIONS.SETTLED]:
    SUBSCRIPTION_PAYMENT_EVENT_TYPES.SETTLED,
};

export async function listSubscriptionPaymentEvents(
  prisma: PrismaService,
  payment: {
    id: string;
    transactionReference: string;
    amount: string;
    currency: string;
  } | null,
): Promise<SubscriptionPaymentEventResponse[]> {
  if (!payment) {
    return [];
  }

  const rows = await prisma.auditLog.findMany({
    where: {
      targetType: 'PaymentTransaction',
      targetId: payment.id,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      action: true,
      createdAt: true,
      payload: true,
      user: { select: { id: true, fullname: true, email: true } },
    },
  });

  return rows.flatMap((row) => {
    const event = toPaymentTransactionEvent(row);
    if (!event) {
      return [];
    }

    return [
      {
        ...event,
        transactionReference:
          event.transactionReference ?? payment.transactionReference,
        amount: event.amount ?? payment.amount,
        currency: event.currency ?? payment.currency,
      },
    ];
  });
}

export function toPaymentTransactionEvent(row: {
  id: string;
  action: string;
  createdAt: Date;
  payload: Prisma.JsonValue;
  user: SubscriptionEventActor | null;
}): SubscriptionPaymentEventResponse | null {
  const type = EVENT_TYPE_BY_ACTION[row.action];
  if (!type) {
    return null;
  }

  const values = readChangeValues(row.payload);
  const status = readString(values.status);
  return {
    id: row.id,
    type,
    occurredAt: row.createdAt.toISOString(),
    status:
      status ??
      (type === SUBSCRIPTION_PAYMENT_EVENT_TYPES.SETTLED ? 'SUCCESS' : null),
    transactionReference: readString(values.transactionReference),
    amount: readString(values.amount),
    currency: readString(values.currency),
    failureReason: readString(values.failureReason),
    actor: row.user,
  };
}

function readChangeValues(payload: Prisma.JsonValue): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  const display = payload.display;
  if (!display || typeof display !== 'object' || Array.isArray(display)) {
    return {};
  }

  if (!('changes' in display) || !Array.isArray(display.changes)) {
    return {};
  }

  const values: Record<string, unknown> = {};
  for (const change of display.changes) {
    if (!change || typeof change !== 'object' || Array.isArray(change)) {
      continue;
    }

    if (!('field' in change) || typeof change.field !== 'string') {
      continue;
    }

    values[change.field] = 'to' in change ? change.to : null;
  }

  return values;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

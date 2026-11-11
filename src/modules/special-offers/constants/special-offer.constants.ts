import type { AuditContext } from '../../../core/audit/interfaces/audit-payload.interface';

/**
 * Audit context for automated reward-engine actions.
 * Uses email/label only — never a fake userId that could be mistaken for a User FK.
 */
export const SYSTEM_SPECIAL_OFFER_AUDIT_CONTEXT: AuditContext = {
  userEmail: 'SYSTEM',
};

/**
 * Emitted by Loan Management after a loan is marked cleared/paid off.
 * Payload: {@link LoanClearedEvent}
 */
export const LOAN_CLEARED_EVENT = 'loan.cleared' as const;

export interface LoanClearedEvent {
  customerId: number;
  tenantId: string;
}

/** Real human user who performed an action (cancel is always this). */
export type OfferUserActor = {
  type: 'USER';
  userId: string;
  fullname: string;
  email: string | null;
};

/**
 * Who issued the offer.
 * SYSTEM = automated reward engine; USER = manual staff grant.
 * Cancellation is never SYSTEM — only humans can cancel.
 */
export type OfferIssuer = { type: 'SYSTEM' } | OfferUserActor;

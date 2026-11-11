import { AgreementStatus } from '@prisma/client';

export const AGREEMENT_STATUS_TRANSITIONS: Record<
  AgreementStatus,
  readonly AgreementStatus[]
> = {
  [AgreementStatus.DRAFT]: [
    AgreementStatus.PUBLISHED,
    AgreementStatus.ARCHIVED,
  ],
  [AgreementStatus.PUBLISHED]: [AgreementStatus.ARCHIVED],
  [AgreementStatus.ARCHIVED]: [AgreementStatus.PUBLISHED],
};

export function isAllowedAgreementStatusTransition(
  from: AgreementStatus,
  to: AgreementStatus,
): boolean {
  if (to === AgreementStatus.DRAFT) {
    return false;
  }

  return AGREEMENT_STATUS_TRANSITIONS[from].includes(to);
}

export function canPublishAgreement(
  effectiveDate: Date,
  now: Date = new Date(),
): boolean {
  return effectiveDate.getTime() <= now.getTime();
}

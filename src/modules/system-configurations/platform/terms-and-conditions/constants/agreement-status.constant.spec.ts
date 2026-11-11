import { describe, expect, it } from '@jest/globals';
import { AgreementStatus } from '@prisma/client';
import {
  canPublishAgreement,
  isAllowedAgreementStatusTransition,
} from './agreement-status.constant';

describe('agreement status rules', () => {
  describe('canPublishAgreement', () => {
    const now = new Date('2026-08-18T12:00:00.000Z');

    it('allows publish when effectiveDate is now or in the past', () => {
      expect(canPublishAgreement(now, now)).toBe(true);
      expect(
        canPublishAgreement(new Date('2026-08-17T00:00:00.000Z'), now),
      ).toBe(true);
    });

    it('blocks publish when effectiveDate is in the future', () => {
      expect(
        canPublishAgreement(new Date('2026-08-19T00:00:00.000Z'), now),
      ).toBe(false);
    });
  });

  describe('isAllowedAgreementStatusTransition', () => {
    it('allows draft to published or archived', () => {
      expect(
        isAllowedAgreementStatusTransition(
          AgreementStatus.DRAFT,
          AgreementStatus.PUBLISHED,
        ),
      ).toBe(true);
      expect(
        isAllowedAgreementStatusTransition(
          AgreementStatus.DRAFT,
          AgreementStatus.ARCHIVED,
        ),
      ).toBe(true);
    });

    it('allows published to archived only', () => {
      expect(
        isAllowedAgreementStatusTransition(
          AgreementStatus.PUBLISHED,
          AgreementStatus.ARCHIVED,
        ),
      ).toBe(true);
      expect(
        isAllowedAgreementStatusTransition(
          AgreementStatus.PUBLISHED,
          AgreementStatus.DRAFT,
        ),
      ).toBe(false);
    });

    it('allows archived to published (republish)', () => {
      expect(
        isAllowedAgreementStatusTransition(
          AgreementStatus.ARCHIVED,
          AgreementStatus.PUBLISHED,
        ),
      ).toBe(true);
    });

    it('forbids reverting published or archived agreements to draft', () => {
      expect(
        isAllowedAgreementStatusTransition(
          AgreementStatus.PUBLISHED,
          AgreementStatus.DRAFT,
        ),
      ).toBe(false);
      expect(
        isAllowedAgreementStatusTransition(
          AgreementStatus.ARCHIVED,
          AgreementStatus.DRAFT,
        ),
      ).toBe(false);
    });
  });
});

import { describe, expect, it } from '@jest/globals';
import { AgreementType } from '@prisma/client';
import {
  AGREEMENT_ANNOUNCEMENT_DURATION_DAYS,
  agreementAnnouncementWindow,
  buildAgreementAnnouncement,
} from './agreement-announcement.constant';

describe('buildAgreementAnnouncement', () => {
  it('names Terms of Service on first publish vs update', () => {
    expect(
      buildAgreementAnnouncement(AgreementType.TERMS_OF_SERVICE, false).title,
    ).toBe('Terms of Service now in effect');
    expect(
      buildAgreementAnnouncement(AgreementType.TERMS_OF_SERVICE, true).title,
    ).toBe('Terms of Service updated');
  });

  it('names Privacy Policy on first publish vs update', () => {
    expect(
      buildAgreementAnnouncement(AgreementType.PRIVACY_POLICY, false).title,
    ).toBe('Privacy Policy now in effect');
    expect(
      buildAgreementAnnouncement(AgreementType.PRIVACY_POLICY, true).title,
    ).toBe('Privacy Policy updated');
  });
});

describe('agreementAnnouncementWindow', () => {
  it('ends after the configured duration', () => {
    const startsAt = new Date('2026-08-18T12:00:00.000Z');
    const { endsAt } = agreementAnnouncementWindow(startsAt);

    expect(endsAt.toISOString()).toBe(
      new Date(
        startsAt.getTime() +
          AGREEMENT_ANNOUNCEMENT_DURATION_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString(),
    );
  });
});

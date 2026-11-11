import { AgreementType } from '@prisma/client';

export const AGREEMENT_ANNOUNCEMENT_DURATION_DAYS = 30;

export function buildAgreementAnnouncement(
  type: AgreementType,
  isUpdate: boolean,
): { title: string; content: string } {
  if (type === AgreementType.TERMS_OF_SERVICE) {
    return isUpdate
      ? {
          title: 'Terms of Service updated',
          content:
            'Our Terms of Service have been updated. Please review and accept the latest version.',
        }
      : {
          title: 'Terms of Service now in effect',
          content:
            'Our Terms of Service have been published. Please review and accept them to continue.',
        };
  }

  return isUpdate
    ? {
        title: 'Privacy Policy updated',
        content:
          'Our Privacy Policy has been updated. Please review and accept the latest version.',
      }
    : {
        title: 'Privacy Policy now in effect',
        content:
          'Our Privacy Policy has been published. Please review and accept it to continue.',
      };
}

export function agreementAnnouncementWindow(startsAt: Date): {
  startsAt: Date;
  endsAt: Date;
} {
  const endsAt = new Date(startsAt);
  endsAt.setUTCDate(
    endsAt.getUTCDate() + AGREEMENT_ANNOUNCEMENT_DURATION_DAYS,
  );

  return { startsAt, endsAt };
}

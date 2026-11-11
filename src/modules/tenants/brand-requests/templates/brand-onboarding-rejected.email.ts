import { getPlatformName } from '../../../../core/email/templates/platform-name.util';
import {
  buildDetailRows,
  buildEmailDocument,
  buildParagraph,
  escapeHtml,
  finishEmailText,
} from '../../../../core/email/templates/email-template.util';

export function buildBrandOnboardingRejectedEmail(params: {
  fullname: string;
  brandName: string;
  rejectionReason: string;
}): { subject: string; html: string; text: string } {
  const platformName = getPlatformName();
  const subject = `Your brand onboarding request for ${params.brandName} was declined`;

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Brand onboarding',
    eyebrowColor: '#b45309',
    icon: 'warning',
    heading: 'Brand workspace declined',
    bodyHtml: [
      buildParagraph(
        `Dear ${escapeHtml(params.fullname)}, ${escapeHtml(platformName)} has declined your request to onboard ${escapeHtml(params.brandName)}.`,
      ),
      buildDetailRows([
        { label: 'Organization', value: params.brandName },
        { label: 'Reason', value: params.rejectionReason },
      ]),
      buildParagraph(
        'You may submit a new request after addressing the feedback above.',
      ),
    ].join(''),
  });

  const text = finishEmailText([
    `Dear ${params.fullname},`,
    '',
    `${platformName} has declined your request to onboard ${params.brandName}.`,
    '',
    `Organization: ${params.brandName}`,
    `Reason: ${params.rejectionReason}`,
    '',
    'You may submit a new request after addressing the feedback above.',
  ]);

  return { subject, html, text };
}

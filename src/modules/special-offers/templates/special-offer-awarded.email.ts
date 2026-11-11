import { formatDisplayDateTime } from '../../../common/utils/format-date.util';
import {
  buildDetailRows,
  buildEmailDocument,
  buildParagraph,
  escapeHtml,
  finishEmailText,
} from '../../../core/email/templates/email-template.util';

export function buildSpecialOfferAwardedEmail(params: {
  fullname: string;
  brandName: string;
  discountLabel: string;
  expiresAt: Date;
  issuedBySystem: boolean;
}): { subject: string; html: string; text: string } {
  const subject = 'You have a special offer waiting';
  const expiresLabel = formatDisplayDateTime(params.expiresAt);
  const sourceLabel = params.issuedBySystem
    ? 'as a thank-you for clearing your loans'
    : 'from their team';

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Special offer',
    icon: 'welcome',
    heading: 'You have a special offer',
    bodyHtml: [
      buildParagraph(
        `Dear ${escapeHtml(params.fullname)}, ${escapeHtml(params.brandName)} has added a special offer to your account ${escapeHtml(sourceLabel)}. You can apply it the next time you take an eligible loan, before it expires.`,
      ),
      buildDetailRows([
        { label: 'Organization', value: params.brandName },
        { label: 'Discount', value: params.discountLabel },
        { label: 'Expires', value: expiresLabel },
      ]),
      buildParagraph(
        'Unused offers expire automatically. Apply the discount at checkout before the date above.',
      ),
    ].join(''),
  });

  const text = finishEmailText([
    `Dear ${params.fullname},`,
    '',
    `${params.brandName} has added a special offer to your account ${sourceLabel}. You can apply it the next time you take an eligible loan, before it expires.`,
    '',
    `Organization: ${params.brandName}`,
    `Discount: ${params.discountLabel}`,
    `Expires: ${expiresLabel}`,
    '',
    'Unused offers expire automatically. Apply the discount at checkout before the date above.',
  ]);

  return { subject, html, text };
}

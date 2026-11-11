import { getPlatformName } from '../../../../core/email/templates/platform-name.util';
import {
  buildDetailRows,
  buildEmailDocument,
  buildParagraph,
  escapeHtml,
  finishEmailText,
} from '../../../../core/email/templates/email-template.util';

export function buildSupportStaffRepliedEmail(params: {
  fullname: string;
  ticketNumber: string;
  categoryName: string;
  brandName?: string | null;
}): { subject: string; html: string; text: string } {
  const subject = `Support replied on ticket ${params.ticketNumber}`;
  const organization = params.brandName?.trim() || '';
  const sender = organization || getPlatformName();
  const intro = organization
    ? `${sender} has replied on your support ticket. Open the ticket to read the message and continue the conversation.`
    : `${sender} support has replied on your ticket. Open the ticket to read the message and continue the conversation.`;

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Support',
    icon: 'neutral',
    heading: 'You have a new support reply',
    bodyHtml: [
      buildParagraph(
        `Dear ${escapeHtml(params.fullname)}, ${escapeHtml(intro)}`,
      ),
      buildDetailRows([
        ...(organization
          ? [{ label: 'Organization', value: organization }]
          : []),
        { label: 'Ticket', value: params.ticketNumber },
        { label: 'Category', value: params.categoryName },
      ]),
    ].join(''),
  });

  const text = finishEmailText([
    `Dear ${params.fullname},`,
    '',
    intro,
    '',
    ...(organization ? [`Organization: ${organization}`] : []),
    `Ticket: ${params.ticketNumber}`,
    `Category: ${params.categoryName}`,
  ]);

  return { subject, html, text };
}

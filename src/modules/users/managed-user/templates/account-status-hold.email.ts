import {
  buildEmailDocument,
  buildParagraph,
  escapeHtml,
} from '../../../../core/email/templates/email-template.util';

export function buildAccountStatusHoldEmail(params: {
  fullname: string;
  isBlocked: boolean;
}): { subject: string; html: string; text: string } {
  const subject = params.isBlocked
    ? 'A hold was applied to your account'
    : 'The hold on your account was lifted';

  const statusMessage = params.isBlocked
    ? 'An administrator placed a hold on your account. Operational activity is restricted until it is lifted.'
    : 'An administrator lifted the hold on your account. Operational activity is available again.';

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Account status',
    eyebrowColor: params.isBlocked ? '#b45309' : undefined,
    icon: params.isBlocked ? 'warning' : 'success',
    heading: params.isBlocked ? 'Activity hold applied' : 'Activity hold lifted',
    bodyHtml: [
      buildParagraph(
        `Hello ${escapeHtml(params.fullname)}, ${escapeHtml(statusMessage)}`,
      ),
      buildParagraph('Contact support if you have questions about this change.'),
    ].join(''),
  });

  const text = [
    `Hello ${params.fullname},`,
    '',
    statusMessage,
    '',
    'Contact support if you have questions about this change.',
  ].join('\n');

  return { subject, html, text };
}

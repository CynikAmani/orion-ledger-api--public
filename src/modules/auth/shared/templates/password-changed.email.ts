import {
  buildEmailDocument,
  buildParagraph,
  escapeHtml,
  getPlatformName,
} from '../../../../core/email/templates/email-template.util';

export function buildPasswordChangedEmail(params: {
  fullname: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Your password was changed';

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Security notice',
    eyebrowColor: '#b45309',
    icon: 'security',
    heading: 'Password updated',
    bodyHtml: [
      buildParagraph(
        `Hello ${escapeHtml(params.fullname)}, your ${escapeHtml(getPlatformName())} password was changed.`,
      ),
      buildParagraph(
        'If you made this change, no action is required. If you did not, contact support immediately.',
      ),
    ].join(''),
  });

  const text = [
    `Hello ${params.fullname},`,
    '',
    `Your ${getPlatformName()} password was changed.`,
    'If you made this change, no action is required. If you did not, contact support immediately.',
  ].join('\n');

  return { subject, html, text };
}

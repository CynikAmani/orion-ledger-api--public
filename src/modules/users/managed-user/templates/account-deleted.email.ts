import {
  buildEmailDocument,
  buildParagraph,
  escapeHtml,
  getPlatformName,
} from '../../../../core/email/templates/email-template.util';

export function buildAccountDeletedEmail(params: {
  fullname: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Your account has been deleted';

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Account update',
    eyebrowColor: '#b45309',
    icon: 'warning',
    heading: 'Account deleted',
    bodyHtml: [
      buildParagraph(
        `Hello ${escapeHtml(params.fullname)}, an administrator deleted your ${escapeHtml(getPlatformName())} account.`,
      ),
      buildParagraph(
        'You can no longer sign in with this account. Contact support if this was a mistake.',
      ),
    ].join(''),
  });

  const text = [
    `Hello ${params.fullname},`,
    '',
    `An administrator deleted your ${getPlatformName()} account.`,
    'You can no longer sign in with this account. Contact support if this was a mistake.',
  ].join('\n');

  return { subject, html, text };
}

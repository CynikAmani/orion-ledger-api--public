import {
  buildEmailDocument,
  buildParagraph,
  escapeHtml,
  getPlatformName,
} from '../../../../core/email/templates/email-template.util';

export function buildAccountRestoredEmail(params: {
  fullname: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Your account has been restored';

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Account restored',
    icon: 'success',
    heading: 'You can sign in again',
    bodyHtml: [
      buildParagraph(
        `Hello ${escapeHtml(params.fullname)}, an administrator restored your ${escapeHtml(getPlatformName())} account.`,
      ),
      buildParagraph(
        'You may sign in again. If you did not expect this, contact support.',
      ),
    ].join(''),
  });

  const text = [
    `Hello ${params.fullname},`,
    '',
    `An administrator restored your ${getPlatformName()} account.`,
    'You may sign in again. If you did not expect this, contact support.',
  ].join('\n');

  return { subject, html, text };
}

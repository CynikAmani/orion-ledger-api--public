import {
  buildEmailDocument,
  buildParagraph,
  escapeHtml,
  getPlatformName,
} from '../../../../core/email/templates/email-template.util';

export function buildMfaPreferenceChangedEmail(params: {
  fullname: string;
  enabled: boolean;
}): { subject: string; html: string; text: string } {
  const subject = params.enabled
    ? 'Sign-in verification was enabled'
    : 'Sign-in verification was disabled';

  const statusLabel = params.enabled ? 'enabled' : 'disabled';

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Security notice',
    eyebrowColor: '#b45309',
    icon: 'security',
    heading: 'Sign-in verification updated',
    bodyHtml: [
      buildParagraph(
        `Hello ${escapeHtml(params.fullname)}, email sign-in verification was ${statusLabel} on your ${escapeHtml(getPlatformName())} account.`,
      ),
      buildParagraph(
        'If you made this change, no action is required. If you did not, change your password immediately and contact support.',
      ),
    ].join(''),
  });

  const text = [
    `Hello ${params.fullname},`,
    '',
    `Email sign-in verification was ${statusLabel} on your ${getPlatformName()} account.`,
    'If you made this change, no action is required. If you did not, change your password immediately and contact support.',
  ].join('\n');

  return { subject, html, text };
}

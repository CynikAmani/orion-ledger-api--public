import {
  buildEmailDocument,
  buildParagraph,
  escapeHtml,
  getPlatformName,
} from '../../../../core/email/templates/email-template.util';

export function buildProfileModifiedByAdminEmail(params: {
  fullname: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Your profile was updated';

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Account update',
    eyebrowColor: '#b45309',
    icon: 'security',
    heading: 'Profile details changed',
    bodyHtml: [
      buildParagraph(
        `Hello ${escapeHtml(params.fullname)}, an administrator updated your ${escapeHtml(getPlatformName())} profile.`,
      ),
      buildParagraph(
        'If you authorized this change, no action is required. If you did not, contact support immediately.',
      ),
    ].join(''),
  });

  const text = [
    `Hello ${params.fullname},`,
    '',
    `An administrator updated your ${getPlatformName()} profile.`,
    'If you authorized this change, no action is required. If you did not, contact support immediately.',
  ].join('\n');

  return { subject, html, text };
}

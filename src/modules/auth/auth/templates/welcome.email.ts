import {
  buildEmailDocument,
  buildParagraph,
  escapeHtml,
  getPlatformName,
} from '../../../../core/email/templates/email-template.util';

export function buildWelcomeEmail(params: {
  fullname: string;
}): { subject: string; html: string; text: string } {
  const platformName = getPlatformName();
  const subject = `Welcome to ${platformName}`;

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Account created',
    icon: 'welcome',
    heading: 'Your account is ready',
    bodyHtml: [
      buildParagraph(
        `Hello ${escapeHtml(params.fullname)}, your ${escapeHtml(platformName)} account has been created.`,
      ),
      buildParagraph('Sign in to complete your profile and start using the platform.'),
    ].join(''),
  });

  const text = [
    `Hello ${params.fullname},`,
    '',
    `Your ${platformName} account has been created.`,
    'Sign in to complete your profile and start using the platform.',
  ].join('\n');

  return { subject, html, text };
}

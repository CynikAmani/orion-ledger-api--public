import {
  buildEmailDocument,
  buildParagraph,
  buildPrimaryButton,
  buildUrlFallback,
  escapeHtml,
  getPlatformName,
} from '../../../../core/email/templates/email-template.util';
import { formatAccountAccessTokenExpiry } from '../../../auth/account-access/constants/account-access-token.constant';

export function buildAccountInvitationEmail(params: {
  fullname: string;
  setupUrl: string;
  linkExpiresIn?: string;
}): { subject: string; html: string; text: string } {
  const linkExpiresIn = params.linkExpiresIn ?? formatAccountAccessTokenExpiry();
  const platformName = getPlatformName();
  const subject = `Set up your ${platformName} account`;

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Account invitation',
    icon: 'account',
    heading: 'Complete your account setup',
    bodyHtml: [
      buildParagraph(
        `Hello ${escapeHtml(params.fullname)}, an administrator created your ${escapeHtml(platformName)} account.`,
      ),
      buildParagraph(
        `Use the link below to activate it and set your password. This link expires in ${escapeHtml(linkExpiresIn)}.`,
      ),
      buildPrimaryButton(params.setupUrl, 'Activate account'),
    ].join(''),
    footerNoteHtml: buildUrlFallback(params.setupUrl),
  });

  const text = [
    `Hello ${params.fullname},`,
    '',
    `An administrator created your ${platformName} account.`,
    `Use the link below to activate it and set your password. This link expires in ${linkExpiresIn}.`,
    '',
    params.setupUrl,
  ].join('\n');

  return { subject, html, text };
}

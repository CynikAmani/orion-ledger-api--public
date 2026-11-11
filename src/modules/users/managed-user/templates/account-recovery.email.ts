import {
  buildEmailDocument,
  buildParagraph,
  buildPrimaryButton,
  buildUrlFallback,
  escapeHtml,
  getPlatformName,
} from '../../../../core/email/templates/email-template.util';
import { formatAccountAccessTokenExpiry } from '../../../auth/account-access/constants/account-access-token.constant';

export function buildAccountRecoveryEmail(params: {
  fullname: string;
  recoveryUrl: string;
  linkExpiresIn?: string;
}): { subject: string; html: string; text: string } {
  const linkExpiresIn = params.linkExpiresIn ?? formatAccountAccessTokenExpiry();
  const subject = `Reset your ${getPlatformName()} password`;

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Account recovery',
    icon: 'account',
    heading: 'Set a new password',
    bodyHtml: [
      buildParagraph(
        `Hello ${escapeHtml(params.fullname)}, an administrator started account recovery for you.`,
      ),
      buildParagraph(
        `Your active sessions were signed out. Use the link below to choose a new password. This link expires in ${escapeHtml(linkExpiresIn)}.`,
      ),
      buildPrimaryButton(params.recoveryUrl, 'Set password'),
    ].join(''),
    footerNoteHtml: [
      buildParagraph(
        'If you did not expect this, contact support immediately.',
      ),
      buildUrlFallback(params.recoveryUrl),
    ].join(''),
  });

  const text = [
    `Hello ${params.fullname},`,
    '',
    'An administrator started account recovery for you.',
    `Your active sessions were signed out. Use the link below to choose a new password. This link expires in ${linkExpiresIn}.`,
    '',
    params.recoveryUrl,
    '',
    'If you did not expect this, contact support immediately.',
  ].join('\n');

  return { subject, html, text };
}

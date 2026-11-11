import {
  buildEmailDocument,
  buildParagraph,
  buildVerificationCodeBlock,
  escapeHtml,
  getPlatformName,
} from '../../../../core/email/templates/email-template.util';

const MFA_PIN_EXPIRES_IN_MINUTES = 5;

export function buildMfaPinEmail(params: {
  fullname: string;
  pin: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Your sign-in verification code';

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Sign-in verification',
    icon: 'security',
    heading: 'Complete your sign-in',
    bodyHtml: [
      buildParagraph(
        `Hello ${escapeHtml(params.fullname)}, use the code below to finish signing in to ${escapeHtml(getPlatformName())}.`,
      ),
      buildVerificationCodeBlock(params.pin),
      buildParagraph(
        `This code expires in <strong>${MFA_PIN_EXPIRES_IN_MINUTES} minutes</strong>. If you did not try to sign in, change your password and contact support.`,
      ),
    ].join(''),
  });

  const text = [
    `Hello ${params.fullname},`,
    '',
    `Use the code below to finish signing in to ${getPlatformName()}.`,
    `Your verification code is: ${params.pin}`,
    `This code expires in ${MFA_PIN_EXPIRES_IN_MINUTES} minutes.`,
    '',
    'If you did not try to sign in, change your password and contact support.',
  ].join('\n');

  return { subject, html, text };
}

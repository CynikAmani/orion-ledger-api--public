import {
  buildEmailDocument,
  buildParagraph,
  buildVerificationCodeBlock,
  escapeHtml,
  getPlatformName,
} from '../../../../core/email/templates/email-template.util';

export function buildPasswordResetPinEmail(params: {
  fullname: string;
  pin: string;
  expiresInMinutes: number;
}): { subject: string; html: string; text: string } {
  const subject = 'Your password reset code';

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Password reset',
    icon: 'password',
    heading: 'Verify your identity',
    bodyHtml: [
      buildParagraph(
        `Hello ${escapeHtml(params.fullname)}, use the code below to reset your ${escapeHtml(getPlatformName())} password.`,
      ),
      buildVerificationCodeBlock(params.pin),
      buildParagraph(
        `This code expires in <strong>${params.expiresInMinutes} minutes</strong>. If you did not request a reset, you can ignore this email.`,
      ),
    ].join(''),
  });

  const text = [
    `Hello ${params.fullname},`,
    '',
    `Use the code below to reset your ${getPlatformName()} password.`,
    `Your verification code is: ${params.pin}`,
    `This code expires in ${params.expiresInMinutes} minutes.`,
    '',
    'If you did not request a reset, you can ignore this email.',
  ].join('\n');

  return { subject, html, text };
}

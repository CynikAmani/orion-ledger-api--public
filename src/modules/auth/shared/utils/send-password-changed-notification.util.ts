import { BrevoEmailService } from '../../../../core/email/services/brevo-email.service';
import { buildPasswordChangedEmail } from '../templates/password-changed.email';

interface PasswordChangedNotificationParams {
  email: string;
  fullname: string;
}

export function sendPasswordChangedNotification(
  emailService: BrevoEmailService,
  params: PasswordChangedNotificationParams,
): void {
  const emailContent = buildPasswordChangedEmail({ fullname: params.fullname });

  void emailService.send({
    to: params.email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  });
}

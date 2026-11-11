export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Template variable substitutions passed through to Brevo (e.g. `{{ params.name }}`). */
  params?: Record<string, string | number | boolean>;
}

export interface IEmailService {
  send(options: SendEmailOptions): Promise<void>;
}

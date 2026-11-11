import { BrevoClient } from '@getbrevo/brevo';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config';

export interface BrevoEmailConfig {
  apiKey: string;
  senderEmail: string;
  senderName: string;
}

export const BREVO_EMAIL_CONFIG = Symbol('BREVO_EMAIL_CONFIG');

export const brevoEmailConfigProvider = {
  provide: BREVO_EMAIL_CONFIG,
  useFactory: (
    config: ConfigService<EnvironmentVariables, true>,
  ): BrevoEmailConfig => ({
    apiKey: config.getOrThrow('BREVO_API_KEY'),
    senderEmail: config.getOrThrow('BREVO_SENDER_EMAIL'),
    senderName: config.getOrThrow('BREVO_SENDER_NAME'),
  }),
  inject: [ConfigService],
};

export interface TransactionalEmailPayload {
  recipient: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  params?: Record<string, string | number | boolean>;
}

@Injectable()
export class BrevoEmailClient {
  private readonly client: BrevoClient;

  constructor(
    @Inject(BREVO_EMAIL_CONFIG) private readonly config: BrevoEmailConfig,
  ) {
    this.client = new BrevoClient({ apiKey: this.config.apiKey });
  }

  async sendTransactionalEmail(
    payload: TransactionalEmailPayload,
  ): Promise<void> {
    await this.client.transactionalEmails.sendTransacEmail({
      sender: {
        email: this.config.senderEmail,
        name: this.config.senderName,
      },
      to: [{ email: payload.recipient }],
      subject: payload.subject,
      htmlContent: payload.htmlContent,
      ...(payload.textContent ? { textContent: payload.textContent } : {}),
      ...(payload.params ? { params: payload.params } : {}),
    });
  }
}

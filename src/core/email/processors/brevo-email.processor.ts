import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { BrevoEmailClient } from '../clients/brevo-email.client';
import { EMAIL_DELIVERY_QUEUE } from '../constants/email-queue.constant';
import type { SendEmailOptions } from '../email.interface';
import { getBrevoErrorMessage } from '../errors/get-brevo-error-message';

@Processor(EMAIL_DELIVERY_QUEUE)
export class BrevoEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(BrevoEmailProcessor.name);

  constructor(private readonly brevoEmailClient: BrevoEmailClient) {
    super();
  }

  async process(job: Job<SendEmailOptions>): Promise<void> {
    const options = job.data;

    try {
      await this.brevoEmailClient.sendTransactionalEmail({
        recipient: options.to,
        subject: options.subject,
        htmlContent: options.html,
        textContent: options.text,
        params: options.params,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send email job ${job.id} to "${options.to}" (subject: "${options.subject}"): ${getBrevoErrorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}

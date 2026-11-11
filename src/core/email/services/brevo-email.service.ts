import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { EMAIL_DELIVERY_QUEUE } from '../constants/email-queue.constant';
import type { IEmailService, SendEmailOptions } from '../email.interface';

@Injectable()
export class BrevoEmailService implements IEmailService {
  private readonly logger = new Logger(BrevoEmailService.name);

  constructor(
    @InjectQueue(EMAIL_DELIVERY_QUEUE) private readonly emailQueue: Queue,
  ) {}

  async send(options: SendEmailOptions): Promise<void> {
    // Keep Redis job payloads lean (Redis Cloud free tier ~30MB RAM).
    const payload: SendEmailOptions = {
      to: options.to,
      subject: options.subject,
      html: options.html,
      ...(options.text !== undefined ? { text: options.text } : {}),
      ...(options.params !== undefined ? { params: options.params } : {}),
    };

    try {
      await this.emailQueue.add('send-brevo-transactional', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      });
    } catch (error) {
      this.logger.error(
        `Failed to enqueue email to "${options.to}" (subject: "${options.subject}")`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

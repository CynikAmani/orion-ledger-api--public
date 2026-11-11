import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  getSharedRedisConnection,
  type EnvironmentVariables,
} from '../config';
import {
  BrevoEmailClient,
  brevoEmailConfigProvider,
} from './clients/brevo-email.client';
import {
  BULLMQ_PREFIX,
  EMAIL_DELIVERY_QUEUE,
} from './constants/email-queue.constant';
import { BrevoEmailProcessor } from './processors/brevo-email.processor';
import { BrevoEmailService } from './services/brevo-email.service';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        // One shared IORedis instance for all Queues + Workers (Redis Cloud 30-conn limit).
        connection: getSharedRedisConnection(config),
        // Prefix + app-specific queue name keep Orion jobs off XC (and vice versa).
        prefix: BULLMQ_PREFIX,
      }),
    }),
    BullModule.registerQueue({
      name: EMAIL_DELIVERY_QUEUE,
    }),
  ],
  providers: [
    brevoEmailConfigProvider,
    BrevoEmailClient,
    BrevoEmailService,
    BrevoEmailProcessor,
  ],
  exports: [BrevoEmailService],
})
export class EmailModule {}

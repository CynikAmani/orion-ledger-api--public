import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScheduleRegistry } from './schedule-registry.service';

@Injectable()
export class ScheduleOrchestratorService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScheduleOrchestratorService.name);
  private isRunning = false;

  constructor(private readonly scheduleRegistry: ScheduleRegistry) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Running scheduled-task catch-up on application bootstrap');
    await this.runAll('bootstrap');
  }

  /**
   * Periodic sweep. Keep the interval relatively frequent so promotion
   * activations/expirations and future due-date reminders stay timely.
   * Individual tasks remain responsible for their own domain logic.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCronTick(): Promise<void> {
    await this.runAll('cron');
  }

  async runAll(trigger: 'bootstrap' | 'cron' | 'manual'): Promise<void> {
    if (this.isRunning) {
      this.logger.debug(
        `Skipping scheduled-task run (${trigger}); previous run still in progress`,
      );
      return;
    }

    const tasks = this.scheduleRegistry.getAll();
    if (tasks.length === 0) {
      return;
    }

    this.isRunning = true;

    try {
      for (const task of tasks) {
        try {
          await task.execute();
        } catch (error) {
          this.logger.error(
            `Scheduled task "${task.name}" failed during ${trigger}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    } finally {
      this.isRunning = false;
    }
  }
}

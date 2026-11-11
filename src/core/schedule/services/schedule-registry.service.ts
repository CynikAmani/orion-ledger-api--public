import { Injectable, Logger } from '@nestjs/common';
import type { ScheduledTask } from '../interfaces/scheduled-task.interface';

@Injectable()
export class ScheduleRegistry {
  private readonly logger = new Logger(ScheduleRegistry.name);
  private readonly tasks = new Map<string, ScheduledTask>();

  register(task: ScheduledTask): void {
    if (this.tasks.has(task.name)) {
      this.logger.warn(
        `Scheduled task "${task.name}" is already registered; replacing`,
      );
    }

    this.tasks.set(task.name, task);
    this.logger.log(`Registered scheduled task "${task.name}"`);
  }

  unregister(name: string): void {
    this.tasks.delete(name);
  }

  getAll(): ScheduledTask[] {
    return [...this.tasks.values()];
  }
}

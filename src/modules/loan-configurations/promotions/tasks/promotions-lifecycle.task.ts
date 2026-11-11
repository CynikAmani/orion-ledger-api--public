import { Injectable, OnModuleInit } from '@nestjs/common';
import type { ScheduledTask } from '../../../../core/schedule/interfaces/scheduled-task.interface';
import { ScheduleRegistry } from '../../../../core/schedule/services/schedule-registry.service';
import { PromotionsService } from '../services/promotions.service';

@Injectable()
export class PromotionsLifecycleTask implements ScheduledTask, OnModuleInit {
  readonly name = 'promotions.lifecycle';

  constructor(
    private readonly scheduleRegistry: ScheduleRegistry,
    private readonly promotionsService: PromotionsService,
  ) {}

  onModuleInit(): void {
    this.scheduleRegistry.register(this);
  }

  execute(): Promise<void> {
    return this.promotionsService.syncLifecycle();
  }
}

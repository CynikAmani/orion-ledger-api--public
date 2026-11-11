import { Injectable, OnModuleInit } from '@nestjs/common';
import type { ScheduledTask } from '../../../../core/schedule/interfaces/scheduled-task.interface';
import { ScheduleRegistry } from '../../../../core/schedule/services/schedule-registry.service';
import { LoansService } from '../services/loans.service';

@Injectable()
export class LoanOverdueLifecycleTask implements ScheduledTask, OnModuleInit {
  readonly name = 'loans.overdue-lifecycle';

  constructor(
    private readonly scheduleRegistry: ScheduleRegistry,
    private readonly loansService: LoansService,
  ) {}

  onModuleInit(): void {
    this.scheduleRegistry.register(this);
  }

  execute(): Promise<void> {
    return this.loansService.syncOverdueLifecycle();
  }
}

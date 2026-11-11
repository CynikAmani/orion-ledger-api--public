import { Injectable, OnModuleInit } from '@nestjs/common';
import type { ScheduledTask } from '../../../core/schedule/interfaces/scheduled-task.interface';
import { ScheduleRegistry } from '../../../core/schedule/services/schedule-registry.service';
import { SandboxCleanupService } from '../services/sandbox-cleanup.service';

@Injectable()
export class SandboxSessionCleanupTask implements ScheduledTask, OnModuleInit {
  readonly name = 'sandbox.sessions.cleanup';

  constructor(
    private readonly scheduleRegistry: ScheduleRegistry,
    private readonly sandboxCleanupService: SandboxCleanupService,
  ) {}

  onModuleInit(): void {
    this.scheduleRegistry.register(this);
  }

  execute(): Promise<void> {
    return this.sandboxCleanupService.revokeExpired();
  }
}

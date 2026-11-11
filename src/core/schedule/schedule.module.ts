import { Global, Module } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { ScheduleOrchestratorService } from './services/schedule-orchestrator.service';
import { ScheduleRegistry } from './services/schedule-registry.service';

@Global()
@Module({
  imports: [NestScheduleModule.forRoot()],
  providers: [ScheduleRegistry, ScheduleOrchestratorService],
  exports: [ScheduleRegistry, ScheduleOrchestratorService],
})
export class ScheduleModule {}

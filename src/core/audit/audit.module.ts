import { Module } from '@nestjs/common';
import { AuditListener } from './listeners/audit.listener';
import { AuditEmitterService } from './services/audit-emitter.service';
import { AuditService } from './services/audit.service';

@Module({
  providers: [AuditService, AuditEmitterService, AuditListener],
  exports: [AuditService, AuditEmitterService],
})
export class AuditModule {}

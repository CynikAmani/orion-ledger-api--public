import { Module } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.module';
import { PlatformAuditLogsController } from './controllers/platform-audit-logs.controller';
import { TenantAuditLogsController } from './controllers/tenant-audit-logs.controller';

@Module({
  imports: [AuditModule],
  controllers: [PlatformAuditLogsController, TenantAuditLogsController],
})
export class AuditLogsModule {}

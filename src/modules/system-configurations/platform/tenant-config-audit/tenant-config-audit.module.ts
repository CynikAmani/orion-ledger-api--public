import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../core/database/prisma.module';
import { PlatformTenantConfigAuditController } from './controllers/platform-tenant-config-audit.controller';
import { PlatformTenantConfigAuditService } from './services/platform-tenant-config-audit.service';

@Module({
  imports: [PrismaModule],
  controllers: [PlatformTenantConfigAuditController],
  providers: [PlatformTenantConfigAuditService],
  exports: [PlatformTenantConfigAuditService],
})
export class TenantConfigAuditModule {}

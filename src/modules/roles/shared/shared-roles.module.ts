import { Module } from '@nestjs/common';
import { AuditModule } from '../../../core/audit/audit.module';
import { PrismaModule } from '../../../core/database/prisma.module';
import { RoleManagementService } from './services/role-management.service';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [RoleManagementService],
  exports: [RoleManagementService],
})
export class SharedRolesModule {}

import { Module } from '@nestjs/common';
import { AuditModule } from '../../../core/audit/audit.module';
import { PrismaModule } from '../../../core/database/prisma.module';
import { ApprovalRequestsService } from './services/approval-requests.service';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [ApprovalRequestsService],
  exports: [ApprovalRequestsService],
})
export class SharedApprovalsModule {}

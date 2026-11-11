import { Module } from '@nestjs/common';
import { SharedApprovalsModule } from '../shared/shared-approvals.module';
import { TenantApprovalsController } from './controllers/tenant-approvals.controller';
import { TenantApprovalsService } from './services/tenant-approvals.service';

@Module({
  imports: [SharedApprovalsModule],
  controllers: [TenantApprovalsController],
  providers: [TenantApprovalsService],
})
export class TenantApprovalsModule {}

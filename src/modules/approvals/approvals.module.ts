import { Module } from '@nestjs/common';
import { PlatformApprovalsModule } from './platform/platform-approvals.module';
import { SharedApprovalsModule } from './shared/shared-approvals.module';
import { TenantApprovalsModule } from './tenant/tenant-approvals.module';

@Module({
  imports: [
    SharedApprovalsModule,
    PlatformApprovalsModule,
    TenantApprovalsModule,
  ],
  exports: [
    SharedApprovalsModule,
    PlatformApprovalsModule,
    TenantApprovalsModule,
  ],
})
export class ApprovalsModule {}

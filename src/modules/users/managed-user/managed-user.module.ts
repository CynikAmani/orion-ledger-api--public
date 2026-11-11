import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { CustomerIdentityDocumentsModule } from '../../customers/identity-documents/customer-identity-documents.module';
import { CustomerLoanActivityModule } from '../../customers/loan-activity/customer-loan-activity.module';
import { SharedUsersModule } from '../shared/shared-users.module';
import { StaffUserController } from './controllers/staff-user.controller';
import { PlatformManagedUsersModule } from './platform/platform-managed-users.module';
import { ManagedUserService } from './services/managed-user.service';
import { SharedManagedUsersModule } from './shared/shared-managed-users.module';
import { TenantManagedUsersModule } from './tenant/tenant-managed-users.module';

@Module({
  imports: [
    PrismaModule,
    SharedUsersModule,
    SharedManagedUsersModule,
    PlatformManagedUsersModule,
    TenantManagedUsersModule,
    CustomerIdentityDocumentsModule,
    CustomerLoanActivityModule,
  ],
  controllers: [StaffUserController],
  providers: [ManagedUserService],
  exports: [ManagedUserService, SharedManagedUsersModule],
})
export class ManagedUserModule {}

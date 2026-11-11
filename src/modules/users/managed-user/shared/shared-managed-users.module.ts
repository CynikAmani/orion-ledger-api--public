import { Module } from '@nestjs/common';
import { AuditModule } from '../../../../core/audit/audit.module';
import { PrismaModule } from '../../../../core/database/prisma.module';
import { AuthModule } from '../../../auth/auth.module';
import { SharedUsersModule } from '../../shared/shared-users.module';
import { ManagedUserIdentityDocumentsService } from './services/managed-user-identity-documents.service';
import { UserManagementService } from './services/user-management.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, SharedUsersModule],
  providers: [UserManagementService, ManagedUserIdentityDocumentsService],
  exports: [UserManagementService, ManagedUserIdentityDocumentsService],
})
export class SharedManagedUsersModule {}

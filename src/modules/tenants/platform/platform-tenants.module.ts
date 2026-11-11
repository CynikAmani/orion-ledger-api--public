import { Module } from '@nestjs/common';
import { AuditModule } from '../../../core/audit/audit.module';
import { AuthModule } from '../../auth/auth.module';
import { SharedManagedUsersModule } from '../../users/managed-user/shared/shared-managed-users.module';
import { SharedTenantsModule } from '../shared/shared-tenants.module';
import { PlatformTenantsController } from './controllers/platform-tenants.controller';
import { PlatformTenantsService } from './services/platform-tenants.service';

@Module({
  imports: [
    AuditModule,
    AuthModule,
    SharedTenantsModule,
    SharedManagedUsersModule,
  ],
  controllers: [PlatformTenantsController],
  providers: [PlatformTenantsService],
})
export class PlatformTenantsModule {}

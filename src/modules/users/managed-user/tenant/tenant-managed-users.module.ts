import { Module } from '@nestjs/common';
import { SharedManagedUsersModule } from '../shared/shared-managed-users.module';
import { TenantManagedUsersController } from './controllers/tenant-managed-users.controller';
import { TenantManagedUsersService } from './services/tenant-managed-users.service';

@Module({
  imports: [SharedManagedUsersModule],
  controllers: [TenantManagedUsersController],
  providers: [TenantManagedUsersService],
})
export class TenantManagedUsersModule {}

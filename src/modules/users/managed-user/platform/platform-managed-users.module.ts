import { Module } from '@nestjs/common';
import { SharedManagedUsersModule } from '../shared/shared-managed-users.module';
import { PlatformManagedUsersController } from './controllers/platform-managed-users.controller';
import { PlatformManagedUsersService } from './services/platform-managed-users.service';

@Module({
  imports: [SharedManagedUsersModule],
  controllers: [PlatformManagedUsersController],
  providers: [PlatformManagedUsersService],
})
export class PlatformManagedUsersModule {}

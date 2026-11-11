import { Module } from '@nestjs/common';
import { ManagedUserModule } from './managed-user/managed-user.module';
import { MeModule } from './me/me.module';
import { SharedUsersModule } from './shared/shared-users.module';

@Module({
  imports: [SharedUsersModule, MeModule, ManagedUserModule],
  exports: [SharedUsersModule],
})
export class UsersModule {}

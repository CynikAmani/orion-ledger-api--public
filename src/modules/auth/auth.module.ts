import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module';
import { UserValidationModule } from '../users/shared/user-validation.module';
import { AccountAccessModule } from './account-access/account-access.module';
import { AuthSessionModule } from './auth/auth.module';
import { MfaModule } from './mfa/mfa.module';
import { PasswordResetModule } from './password-reset/password-reset.module';
import { SharedAuthModule } from './shared/shared-auth.module';

@Module({
  imports: [
    PrismaModule,
    UserValidationModule,
    SharedAuthModule,
    AuthSessionModule,
    MfaModule,
    PasswordResetModule,
    AccountAccessModule,
  ],
  exports: [SharedAuthModule, AuthSessionModule, AccountAccessModule],
})
export class AuthModule {}

import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { MfaSettingsModule } from '../../system-configurations/platform/mfa-settings/mfa-settings.module';
import { UserValidationModule } from '../../users/shared/user-validation.module';
import { AuthSessionModule } from '../auth/auth.module';
import { SharedAuthModule } from '../shared/shared-auth.module';
import { MfaTokenService } from './services/mfa-token.service';
import { MfaService } from './services/mfa.service';

@Module({
  imports: [
    PrismaModule,
    MfaSettingsModule,
    UserValidationModule,
    SharedAuthModule,
    forwardRef(() => AuthSessionModule),
  ],
  providers: [MfaTokenService, MfaService],
  exports: [MfaService],
})
export class MfaModule {}

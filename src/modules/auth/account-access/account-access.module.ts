import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { UserValidationModule } from '../../users/shared/user-validation.module';
import { SharedAuthModule } from '../shared/shared-auth.module';
import { AccountAccessController } from './controller/account-access.controller';
import { AccountAccessTokenService } from './services/account-access-token.service';
import { AccountAccessService } from './services/account-access.service';

@Module({
  imports: [PrismaModule, UserValidationModule, SharedAuthModule],
  controllers: [AccountAccessController],
  providers: [AccountAccessTokenService, AccountAccessService],
  exports: [AccountAccessTokenService],
})
export class AccountAccessModule {}

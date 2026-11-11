import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { TermsAndConditionsModule } from '../../system-configurations/platform/terms-and-conditions/terms-and-conditions.module';
import { AvatarStorageService } from './services/avatar-storage.service';
import { IdentityDocumentStorageService } from './services/identity-document-storage.service';
import { UserEligibilityService } from './services/user-eligibility.service';
import { UserAvatarService } from './services/user-avatar.service';
import { UserValidationModule } from './user-validation.module';

@Module({
  imports: [PrismaModule, TermsAndConditionsModule, UserValidationModule],
  providers: [
    AvatarStorageService,
    IdentityDocumentStorageService,
    UserAvatarService,
    UserEligibilityService,
  ],
  exports: [
    AvatarStorageService,
    IdentityDocumentStorageService,
    UserAvatarService,
    UserEligibilityService,
    UserValidationModule,
  ],
})
export class SharedUsersModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { UserAccountLifecycleValidator } from './validators/user-account-lifecycle.validator';
import { UserBusinessEligibilityValidator } from './validators/user-business-eligibility.validator';

@Module({
  imports: [PrismaModule],
  providers: [
    UserAccountLifecycleValidator,
    UserBusinessEligibilityValidator,
  ],
  exports: [
    UserAccountLifecycleValidator,
    UserBusinessEligibilityValidator,
  ],
})
export class UserValidationModule {}

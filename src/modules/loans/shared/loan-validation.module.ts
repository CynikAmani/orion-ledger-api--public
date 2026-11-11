import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { TermsAndConditionsModule } from '../../system-configurations/platform/terms-and-conditions/terms-and-conditions.module';
import { TenantTermsAndConditionsModule } from '../../system-configurations/tenant/tenant-terms-and-conditions/tenant-terms-and-conditions.module';
import { SharedUsersModule } from '../../users/shared/shared-users.module';
import { LoanProvisionEligibilityValidator } from './validators/loan-provision-eligibility.validator';

@Module({
  imports: [
    PrismaModule,
    TermsAndConditionsModule,
    TenantTermsAndConditionsModule,
    SharedUsersModule,
  ],
  providers: [LoanProvisionEligibilityValidator],
  exports: [LoanProvisionEligibilityValidator],
})
export class LoanValidationModule {}

import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { CustomerLoanActivityModule } from '../../customers/loan-activity/customer-loan-activity.module';
import { LoanApplicationSettingsModule } from '../../loan-configurations/application-settings/loan-application-settings.module';
import { InterestRatesModule } from '../../loan-configurations/interest-rates/interest-rates.module';
import { SpecialOffersModule } from '../../special-offers/special-offers.module';
import { SharedTenantsModule } from '../../tenants/shared/shared-tenants.module';
import { UserValidationModule } from '../../users/shared/user-validation.module';
import { LoanRepaymentsModule } from '../repayments/loan-repayments.module';
import { LoanValidationModule } from '../shared/loan-validation.module';
import { RepaymentDetailsModule } from '../../repayment-details/repayment-details.module';
import { LoansService } from './services/loans.service';

/** Service-only: importing this must not register GET /loans/:loanId. */
@Module({
  imports: [
    PrismaModule,
    InterestRatesModule,
    CustomerLoanActivityModule,
    UserValidationModule,
    SpecialOffersModule,
    SharedTenantsModule,
    LoanApplicationSettingsModule,
    LoanValidationModule,
    RepaymentDetailsModule,
    forwardRef(() => LoanRepaymentsModule),
  ],
  providers: [LoansService],
  exports: [LoansService],
})
export class LoanRecordsCoreModule {}

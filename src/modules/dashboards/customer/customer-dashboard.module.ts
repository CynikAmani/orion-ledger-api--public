import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { CustomerLoanActivityModule } from '../../customers/loan-activity/customer-loan-activity.module';
import { LoanApplicationSettingsModule } from '../../loan-configurations/application-settings/loan-application-settings.module';
import { InterestRatesModule } from '../../loan-configurations/interest-rates/interest-rates.module';
import { LoanTypesModule } from '../../loan-configurations/loan-types/loan-types.module';
import { LoanApplicationsModule } from '../../loans/applications/loan-applications.module';
import { LoanRecordsCoreModule } from '../../loans/records/loan-records-core.module';
import { SpecialOffersModule } from '../../special-offers/special-offers.module';
import { CustomerDashboardController } from './controllers/customer-dashboard.controller';
import { CustomerDashboardService } from './services/customer-dashboard.service';

@Module({
  imports: [
    PrismaModule,
    LoanRecordsCoreModule,
    LoanApplicationsModule,
    SpecialOffersModule,
    InterestRatesModule,
    LoanTypesModule,
    LoanApplicationSettingsModule,
    CustomerLoanActivityModule,
  ],
  controllers: [CustomerDashboardController],
  providers: [CustomerDashboardService],
  exports: [CustomerDashboardService],
})
export class CustomerDashboardModule {}

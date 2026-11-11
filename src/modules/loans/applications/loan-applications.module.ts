import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { CustomerLoanActivityModule } from '../../customers/loan-activity/customer-loan-activity.module';
import { LoanApplicationSettingsModule } from '../../loan-configurations/application-settings/loan-application-settings.module';
import { InterestRatesModule } from '../../loan-configurations/interest-rates/interest-rates.module';
import { SpecialOffersModule } from '../../special-offers/special-offers.module';
import { SharedTenantsModule } from '../../tenants/shared/shared-tenants.module';
import { UserValidationModule } from '../../users/shared/user-validation.module';
import { LoanRecordsCoreModule } from '../records/loan-records-core.module';
import { LoanValidationModule } from '../shared/loan-validation.module';
import { LoanApplicationsController } from './controllers/loan-applications.controller';
import { MyLoanApplicationsController } from './controllers/my-loan-applications.controller';
import { LoanApplicationsService } from './services/loan-applications.service';

@Module({
  imports: [
    PrismaModule,
    LoanRecordsCoreModule,
    SpecialOffersModule,
    InterestRatesModule,
    LoanApplicationSettingsModule,
    CustomerLoanActivityModule,
    UserValidationModule,
    LoanValidationModule,
    SharedTenantsModule,
  ],
  controllers: [MyLoanApplicationsController, LoanApplicationsController],
  providers: [LoanApplicationsService],
  exports: [LoanApplicationsService],
})
export class LoanApplicationsModule {}

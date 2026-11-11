import { Module } from '@nestjs/common';
import { LoanApplicationSettingsModule } from './application-settings/loan-application-settings.module';
import { InterestRatesModule } from './interest-rates/interest-rates.module';
import { LoanTypesModule } from './loan-types/loan-types.module';
import { PromotionsModule } from './promotions/promotions.module';

@Module({
  imports: [
    LoanTypesModule,
    InterestRatesModule,
    PromotionsModule,
    LoanApplicationSettingsModule,
  ],
  exports: [
    LoanTypesModule,
    InterestRatesModule,
    PromotionsModule,
    LoanApplicationSettingsModule,
  ],
})
export class LoanConfigurationsModule {}

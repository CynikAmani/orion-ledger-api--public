import { Module } from '@nestjs/common';
import { LoanApplicationsModule } from './applications/loan-applications.module';
import { LoanInsightsModule } from './insights/loan-insights.module';
import { LoanPortfolioModule } from './portfolio/loan-portfolio.module';
import { LoanRecordsModule } from './records/loan-records.module';
import { LoanRepaymentsModule } from './repayments/loan-repayments.module';
import { LoanReportsModule } from './reports/loan-reports.module';

@Module({
  imports: [
    LoanApplicationsModule,
    LoanPortfolioModule,
    LoanReportsModule,
    LoanInsightsModule,
    LoanRepaymentsModule,
    LoanRecordsModule,
  ],
  exports: [
    LoanApplicationsModule,
    LoanPortfolioModule,
    LoanReportsModule,
    LoanInsightsModule,
    LoanRepaymentsModule,
    LoanRecordsModule,
  ],
})
export class LoansModule {}

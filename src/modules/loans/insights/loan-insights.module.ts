import { Module } from '@nestjs/common';
import { ManagedUserModule } from '../../users/managed-user/managed-user.module';
import { LoanRecordsCoreModule } from '../records/loan-records-core.module';
import { LoanRepaymentsModule } from '../repayments/loan-repayments.module';
import { LoanInsightsController } from './controllers/loan-insights.controller';
import { LoanInsightsService } from './services/loan-insights.service';

@Module({
  imports: [LoanRecordsCoreModule, LoanRepaymentsModule, ManagedUserModule],
  controllers: [LoanInsightsController],
  providers: [LoanInsightsService],
  exports: [LoanInsightsService],
})
export class LoanInsightsModule {}

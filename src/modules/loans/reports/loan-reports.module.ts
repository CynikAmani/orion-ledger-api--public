import { Module } from '@nestjs/common';
import { ManagedUserModule } from '../../users/managed-user/managed-user.module';
import { LoanApplicationsModule } from '../applications/loan-applications.module';
import { LoanRecordsCoreModule } from '../records/loan-records-core.module';
import { LoanRepaymentsModule } from '../repayments/loan-repayments.module';
import { LoanReportsController } from './controllers/loan-reports.controller';
import { LoanReportsService } from './services/loan-reports.service';

@Module({
  imports: [
    LoanRecordsCoreModule,
    LoanRepaymentsModule,
    LoanApplicationsModule,
    ManagedUserModule,
  ],
  controllers: [LoanReportsController],
  providers: [LoanReportsService],
  exports: [LoanReportsService],
})
export class LoanReportsModule {}

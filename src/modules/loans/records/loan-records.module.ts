import { Module } from '@nestjs/common';
import { LoanRecordsCoreModule } from './loan-records-core.module';
import { LoansController } from './controllers/loans.controller';
import { LoanDatasetService } from './services/loan-dataset.service';
import { MyLoansController } from './controllers/my-loans.controller';
import { LoanOverdueLifecycleTask } from './tasks/loan-overdue-lifecycle.task';

@Module({
  imports: [LoanRecordsCoreModule],
  controllers: [MyLoansController, LoansController],
  providers: [LoanOverdueLifecycleTask, LoanDatasetService],
  exports: [LoanRecordsCoreModule],
})
export class LoanRecordsModule {}

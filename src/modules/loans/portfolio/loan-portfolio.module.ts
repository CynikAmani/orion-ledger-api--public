import { Module } from '@nestjs/common';
import { LoanApplicationsModule } from '../applications/loan-applications.module';
import { LoanRecordsCoreModule } from '../records/loan-records-core.module';
import { LoanPortfolioController } from './controllers/loan-portfolio.controller';
import { LoanPortfolioService } from './services/loan-portfolio.service';

@Module({
  imports: [LoanRecordsCoreModule, LoanApplicationsModule],
  controllers: [LoanPortfolioController],
  providers: [LoanPortfolioService],
  exports: [LoanPortfolioService],
})
export class LoanPortfolioModule {}

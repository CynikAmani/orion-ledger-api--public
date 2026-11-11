import { Module } from '@nestjs/common';
import { LoanInsightsModule } from '../../loans/insights/loan-insights.module';
import { LoanPortfolioModule } from '../../loans/portfolio/loan-portfolio.module';
import { LoanReportsModule } from '../../loans/reports/loan-reports.module';
import { StaffDashboardController } from './controllers/staff-dashboard.controller';
import { StaffDashboardService } from './services/staff-dashboard.service';

@Module({
  imports: [LoanPortfolioModule, LoanReportsModule, LoanInsightsModule],
  controllers: [StaffDashboardController],
  providers: [StaffDashboardService],
  exports: [StaffDashboardService],
})
export class StaffDashboardModule {}

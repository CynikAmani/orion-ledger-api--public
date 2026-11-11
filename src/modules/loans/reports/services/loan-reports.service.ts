import { Injectable } from '@nestjs/common';
import {
  ManagedUserService,
  type ManagedUserContactDetails,
} from '../../../users/managed-user/services/managed-user.service';
import { LoanApplicationsService } from '../../applications/services/loan-applications.service';
import { LoansService } from '../../records/services/loans.service';
import { RepaymentsService } from '../../repayments/services/repayments.service';
import type { LoanPeriodWindow } from '../../shared/types/loan-period-window';
import { LOAN_REPORTS_BORROWER_LEADERBOARD_LIMIT } from '../constants/loan-reports.constant';
import { ReportQueryDto } from '../dto/report-query.dto';
import { resolveReportWindow } from '../utils/resolve-report-window.util';

export interface LoanReportsCustomerSummary {
  userId: string;
  fullname: string;
  email: string | null;
  phone: string | null;
}

export interface LoanReportsIssuedAmountBorrower {
  customerId: string;
  totalAmountIssued: number;
  loansIssuedCount: number;
  customer: LoanReportsCustomerSummary | null;
}

export interface LoanReportsRepaymentActivityBorrower {
  customerId: string;
  repaymentCount: number;
  totalAmountCollected: number;
  loansClearedInPeriodCount: number;
  customer: LoanReportsCustomerSummary | null;
}

export interface LoanReportsSnapshotResponse {
  generatedAt: Date;
  period: LoanPeriodWindow;
  cumulativePortfolio: {
    totalLoansDisbursedCount: number;
    totalAmountDisbursed: number;
    totalLoansClearedCount: number;
    totalAmountCleared: number;
    activeStatusLoanCount: number;
    activeStatusOutstandingBalance: number;
    overdueLoanCount: number;
    overdueOutstandingBalance: number;
    defaultedLoanCount: number;
    defaultedOutstandingBalance: number;
    writtenOffLoanCount: number;
    writtenOffVolume: number;
  };
  periodCashFlow: {
    totalAmountCollected: number;
    principalAmountRepaid: number;
    interestAmountEarned: number;
    penaltiesCollected: number;
  };
  periodDisbursement: {
    totalAmountDisbursed: number;
    loansIssuedCount: number;
    averageLoanAmount: number;
  };
  periodApplicationMetrics: {
    submittedCount: number;
    approvedCount: number;
    rejectedCount: number;
    approvalRatePercentage: number;
  };
  leaderboards: {
    topBorrowersByDisbursedVolume: LoanReportsIssuedAmountBorrower[];
    topBorrowersByRepaymentActivity: LoanReportsRepaymentActivityBorrower[];
  };
}

export interface LoanReportsPeriodOperatingTotals {
  period: LoanPeriodWindow;
  periodCashFlow: LoanReportsSnapshotResponse['periodCashFlow'];
  periodDisbursement: LoanReportsSnapshotResponse['periodDisbursement'];
  periodApplicationMetrics: LoanReportsSnapshotResponse['periodApplicationMetrics'];
}

@Injectable()
export class LoanReportsService {
  constructor(
    private readonly loansService: LoansService,
    private readonly repaymentsService: RepaymentsService,
    private readonly loanApplicationsService: LoanApplicationsService,
    private readonly managedUserService: ManagedUserService,
  ) {}

  /**
   * Period origination + collections + application funnel.
   * No cumulative book and no borrower leaderboards.
   */
  async getPeriodOperatingTotals(
    tenantId: string,
    query: ReportQueryDto = {},
  ): Promise<LoanReportsPeriodOperatingTotals> {
    const period = resolveReportWindow(query);
    const [cashFlow, disbursement, periodApplicationMetrics] =
      await Promise.all([
        this.repaymentsService.getCashFlowYield(tenantId, period),
        this.loansService.getDisbursementSummary(tenantId, period),
        this.loanApplicationsService.getPeriodApplicationMetrics(
          tenantId,
          period,
        ),
      ]);

    return {
      period,
      periodCashFlow: {
        totalAmountCollected: cashFlow.totalCollected,
        principalAmountRepaid: cashFlow.principalRepaid,
        interestAmountEarned: cashFlow.interestEarned,
        penaltiesCollected: cashFlow.penaltiesCollected,
      },
      periodDisbursement: {
        totalAmountDisbursed: disbursement.totalDisbursed,
        loansIssuedCount: disbursement.loansIssuedCount,
        averageLoanAmount: disbursement.averageLoanAmount,
      },
      periodApplicationMetrics,
    };
  }

  async getSnapshot(
    tenantId: string,
    query: ReportQueryDto,
  ): Promise<LoanReportsSnapshotResponse> {
    const period = resolveReportWindow(query);
    const borrowerLeaderboardLimit =
      query.borrowerLeaderboardLimit ??
      LOAN_REPORTS_BORROWER_LEADERBOARD_LIMIT.DEFAULT;

    const [
      cumulativePortfolio,
      cashFlow,
      disbursement,
      periodApplicationMetrics,
      issuedAmountBorrowers,
      repaymentActivityBorrowers,
    ] = await Promise.all([
      this.loansService.getCumulativePortfolioMetrics(tenantId),
      this.repaymentsService.getCashFlowYield(tenantId, period),
      this.loansService.getDisbursementSummary(tenantId, period),
      this.loanApplicationsService.getPeriodApplicationMetrics(
        tenantId,
        period,
      ),
      this.loansService.getTopBorrowersByIssuedVolume(
        tenantId,
        period,
        borrowerLeaderboardLimit,
      ),
      this.repaymentsService.getMostActiveBorrowers(
        tenantId,
        period,
        borrowerLeaderboardLimit,
      ),
    ]);

    const profiles = await this.managedUserService.findContactDetailsByIds([
      ...new Set([
        ...issuedAmountBorrowers.map((row) => row.customerId),
        ...repaymentActivityBorrowers.map((row) => row.customerId),
      ]),
    ]);
    const profileById = new Map(
      profiles.map((profile) => [profile.userId, profile]),
    );

    return {
      generatedAt: new Date(),
      period,
      cumulativePortfolio,
      periodCashFlow: {
        totalAmountCollected: cashFlow.totalCollected,
        principalAmountRepaid: cashFlow.principalRepaid,
        interestAmountEarned: cashFlow.interestEarned,
        penaltiesCollected: cashFlow.penaltiesCollected,
      },
      periodDisbursement: {
        totalAmountDisbursed: disbursement.totalDisbursed,
        loansIssuedCount: disbursement.loansIssuedCount,
        averageLoanAmount: disbursement.averageLoanAmount,
      },
      periodApplicationMetrics,
      leaderboards: {
        topBorrowersByDisbursedVolume: issuedAmountBorrowers.map((row) => ({
          customerId: row.customerId,
          totalAmountIssued: row.totalIssued,
          loansIssuedCount: row.loansIssuedCount,
          customer: this.toCustomerSummary(profileById.get(row.customerId)),
        })),
        topBorrowersByRepaymentActivity: repaymentActivityBorrowers.map(
          (row) => ({
            customerId: row.customerId,
            repaymentCount: row.repaymentCount,
            totalAmountCollected: row.amountCollected,
            loansClearedInPeriodCount: row.completedLoanCount,
            customer: this.toCustomerSummary(profileById.get(row.customerId)),
          }),
        ),
      },
    };
  }

  private toCustomerSummary(
    profile: ManagedUserContactDetails | undefined,
  ): LoanReportsCustomerSummary | null {
    if (!profile) {
      return null;
    }

    return {
      userId: profile.userId,
      fullname: profile.fullname,
      email: profile.email,
      phone: profile.phone,
    };
  }
}

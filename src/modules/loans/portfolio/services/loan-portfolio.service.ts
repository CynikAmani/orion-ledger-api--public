import { Injectable } from '@nestjs/common';
import { LoanApplicationsService } from '../../applications/services/loan-applications.service';
import { LoansService } from '../../records/services/loans.service';

export interface LoanPortfolioRiskSlice {
  loanCount: number;
  outstandingBalance: number;
}

export interface LoanPortfolioOverdueSlice extends LoanPortfolioRiskSlice {
  breakdown: Array<{
    status: string;
    loanCount: number;
    outstandingBalance: number;
  }>;
}

/**
 * Live uncleared book. Risk slices are a partition:
 * performing + overdue + defaulted outstanding = totalOutstandingBalance
 * performing + overdue + defaulted counts = loanCount
 */
export interface LoanPortfolioSnapshotResponse {
  generatedAt: Date;
  unclearedBook: {
    loanCount: number;
    totalOutstandingBalance: number;
    composition: {
      principalOutstanding: number;
      interestOutstanding: number;
    };
    performing: LoanPortfolioRiskSlice;
    overdue: LoanPortfolioOverdueSlice;
    defaulted: LoanPortfolioRiskSlice;
  };
  pipeline: {
    pendingUnreviewedApplicationCount: number;
    pendingReviewVolume: number;
  };
}

@Injectable()
export class LoanPortfolioService {
  constructor(
    private readonly loansService: LoansService,
    private readonly loanApplicationsService: LoanApplicationsService,
  ) {}

  async getSnapshot(tenantId: string): Promise<LoanPortfolioSnapshotResponse> {
    const [book, pipeline] = await Promise.all([
      this.loansService.getOpenBookMetrics(tenantId),
      this.loanApplicationsService.getPendingPipelineMetrics(tenantId),
    ]);

    return {
      generatedAt: new Date(),
      unclearedBook: {
        loanCount: book.unclearedLoanCount,
        totalOutstandingBalance: book.outstandingBalance,
        composition: {
          principalOutstanding: book.principalOutstanding,
          interestOutstanding: book.interestOutstanding,
        },
        performing: {
          loanCount: book.performingLoanCount,
          outstandingBalance: book.performingOutstandingBalance,
        },
        overdue: {
          loanCount: book.overdueCount,
          outstandingBalance: book.overdueVolume,
          breakdown: book.overdueBreakdown,
        },
        defaulted: {
          loanCount: book.defaultedLoanCount,
          outstandingBalance: book.defaultedOutstandingBalance,
        },
      },
      pipeline,
    };
  }

  /**
   * Uncleared, not-defaulted loans whose endDate falls on the given UTC day.
   */
  countUnclearedLoansDueOnUtcDay(
    tenantId: string,
    day: Date = new Date(),
  ): Promise<number> {
    return this.loansService.countUnclearedLoansDueOnUtcDay(tenantId, day);
  }
}

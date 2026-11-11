import { Injectable } from '@nestjs/common';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import type { AuthenticatedUser } from '../../../auth/shared/types/authenticated-user.type';
import { resolveCallerTenantId } from '../../../roles/shared/utils/resolve-caller-tenant.util';
import { LoanInsightsService } from '../../../loans/insights/services/loan-insights.service';
import {
  LoanPortfolioService,
  type LoanPortfolioSnapshotResponse,
} from '../../../loans/portfolio/services/loan-portfolio.service';
import {
  LoanReportsService,
  type LoanReportsPeriodOperatingTotals,
} from '../../../loans/reports/services/loan-reports.service';

/**
 * Remaining contractual balance on uncleared loans:
 * unpaid principal + unpaid interest (loan.returnAmount - sum of repayments).
 */
export interface StaffDashboardExposureSlice {
  loanCount: number;
  outstandingPrincipalPlusInterest: number;
}

export interface StaffDashboardTotalOpenExposure
  extends StaffDashboardExposureSlice {
  remainingPrincipal: number;
  remainingInterest: number;
}

export interface StaffDashboardDailyDisbursementPoint {
  /** UTC calendar day, YYYY-MM-DD. */
  utcDate: string;
  loansIssuedCount: number;
  /** Sum of loan.loanAmount issued on that UTC day. */
  principalAmountDisbursed: number;
}

export interface StaffDashboardActionQueue {
  /** Loan applications with isReviewed = false. */
  unreviewedApplicationCount: number;
  /** Sum of loanAmount on unreviewed applications (requested principal). */
  unreviewedApplicationsRequestedPrincipal: number;
  /**
   * Uncleared, not-defaulted loans whose endDate falls on the current UTC
   * calendar day. Loans already past the exact timestamp today also appear
   * in overdueUnclearedLoanCount.
   */
  unclearedLoansDueTodayUtcCount: number;
  /**
   * Uncleared, not-defaulted loans with endDate before now
   * (delinquent / overdue).
   */
  overdueUnclearedLoanCount: number;
}

export interface StaffDashboardPortfolioRisk {
  totalOpenExposure: StaffDashboardTotalOpenExposure;
  /**
   * Uncleared, not defaulted, endDate on or after now
   * (still within contractual term).
   */
  performingNotPastDue: StaffDashboardExposureSlice;
  /**
   * Uncleared, not defaulted, endDate before now
   * (past contractual term, not formally defaulted).
   */
  overdueNotDefaulted: StaffDashboardExposureSlice;
  /** Uncleared loans with status DEFAULTED. */
  defaulted: StaffDashboardExposureSlice;
}

export interface StaffDashboardCurrentUtcMonthPerformance {
  calendarYear: number;
  calendarMonth: number;
  periodStartInclusive: Date;
  periodEndExclusive: Date;
  /** Sum of loan.loanAmount for loans with startDate in this UTC month. */
  principalAmountDisbursed: number;
  loansIssuedCount: number;
  /**
   * Interest portion of repayments with datePaid in this UTC month
   * (pro-rata from each loan's loanAmount / returnAmount).
   */
  interestAmountCollectedFromRepayments: number;
  applicationsSubmittedCount: number;
  applicationsApprovedCount: number;
  applicationsRejectedCount: number;
  /** approved / submitted, one decimal. 0 when submittedCount is 0. */
  applicationApprovalRatePercentage: number;
}

export interface StaffDashboardMiniTrends {
  currentUtcMonthDailyDisbursements: StaffDashboardDailyDisbursementPoint[];
}

export interface StaffDashboardResponse {
  generatedAt: Date;
  /** Null when the caller lacks tenant:staff-dashboard:action-queue. */
  actionQueue: StaffDashboardActionQueue | null;
  /** Null when the caller lacks tenant:staff-dashboard:portfolio-risk. */
  portfolioRisk: StaffDashboardPortfolioRisk | null;
  /** Null when the caller lacks tenant:staff-dashboard:month-performance. */
  currentUtcMonthPerformance: StaffDashboardCurrentUtcMonthPerformance | null;
  /** Null when the caller lacks tenant:staff-dashboard:mini-trends. */
  miniTrends: StaffDashboardMiniTrends | null;
}

@Injectable()
export class StaffDashboardService {
  constructor(
    private readonly loanPortfolioService: LoanPortfolioService,
    private readonly loanReportsService: LoanReportsService,
    private readonly loanInsightsService: LoanInsightsService,
  ) {}

  async getDashboardOverview(
    user: AuthenticatedUser,
  ): Promise<StaffDashboardResponse> {
    const tenantId = resolveCallerTenantId(user);
    const permissions = user.permissions ?? [];

    const canActionQueue = this.has(
      permissions,
      PERMISSIONS.STAFF_DASHBOARD.ACTION_QUEUE,
    );
    const canPortfolioRisk = this.has(
      permissions,
      PERMISSIONS.STAFF_DASHBOARD.PORTFOLIO_RISK,
    );
    const canMonthPerformance = this.has(
      permissions,
      PERMISSIONS.STAFF_DASHBOARD.MONTH_PERFORMANCE,
    );
    const canMiniTrends = this.has(
      permissions,
      PERMISSIONS.STAFF_DASHBOARD.MINI_TRENDS,
    );

    const needsPortfolioSnapshot = canActionQueue || canPortfolioRisk;

    const [portfolio, unclearedLoansDueTodayUtcCount, monthPerformance, daily] =
      await Promise.all([
        needsPortfolioSnapshot
          ? this.loanPortfolioService.getSnapshot(tenantId)
          : Promise.resolve(null),
        canActionQueue
          ? this.loanPortfolioService.countUnclearedLoansDueOnUtcDay(tenantId)
          : Promise.resolve(null),
        canMonthPerformance
          ? this.loanReportsService.getPeriodOperatingTotals(tenantId, {})
          : Promise.resolve(null),
        canMiniTrends
          ? this.loanInsightsService.getCurrentUtcMonthDailyDisbursements(
              tenantId,
            )
          : Promise.resolve(null),
      ]);

    return {
      generatedAt: new Date(),
      actionQueue:
        canActionQueue && portfolio && unclearedLoansDueTodayUtcCount != null
          ? {
              unreviewedApplicationCount:
                portfolio.pipeline.pendingUnreviewedApplicationCount,
              unreviewedApplicationsRequestedPrincipal:
                portfolio.pipeline.pendingReviewVolume,
              unclearedLoansDueTodayUtcCount,
              overdueUnclearedLoanCount: portfolio.unclearedBook.overdue.loanCount,
            }
          : null,
      portfolioRisk:
        canPortfolioRisk && portfolio
          ? this.toPortfolioRisk(portfolio.unclearedBook)
          : null,
      currentUtcMonthPerformance: monthPerformance
        ? this.toMonthPerformance(monthPerformance)
        : null,
      miniTrends: daily
        ? {
            currentUtcMonthDailyDisbursements: daily.map((point) => ({
              utcDate: point.date,
              loansIssuedCount: point.loanCount,
              principalAmountDisbursed: point.totalAmountDisbursed,
            })),
          }
        : null,
    };
  }

  private has(permissions: string[], permission: string): boolean {
    return permissions.includes(permission);
  }

  private toPortfolioRisk(
    book: LoanPortfolioSnapshotResponse['unclearedBook'],
  ): StaffDashboardPortfolioRisk {
    return {
      totalOpenExposure: {
        loanCount: book.loanCount,
        outstandingPrincipalPlusInterest: book.totalOutstandingBalance,
        remainingPrincipal: book.composition.principalOutstanding,
        remainingInterest: book.composition.interestOutstanding,
      },
      performingNotPastDue: this.toExposureSlice(book.performing),
      overdueNotDefaulted: this.toExposureSlice(book.overdue),
      defaulted: this.toExposureSlice(book.defaulted),
    };
  }

  private toMonthPerformance(
    monthPerformance: LoanReportsPeriodOperatingTotals,
  ): StaffDashboardCurrentUtcMonthPerformance {
    const periodStart = monthPerformance.period.start;
    const funnel = monthPerformance.periodApplicationMetrics;

    return {
      calendarYear: periodStart.getUTCFullYear(),
      calendarMonth: periodStart.getUTCMonth() + 1,
      periodStartInclusive: periodStart,
      periodEndExclusive: monthPerformance.period.endExclusive,
      principalAmountDisbursed:
        monthPerformance.periodDisbursement.totalAmountDisbursed,
      loansIssuedCount: monthPerformance.periodDisbursement.loansIssuedCount,
      interestAmountCollectedFromRepayments:
        monthPerformance.periodCashFlow.interestAmountEarned,
      applicationsSubmittedCount: funnel.submittedCount,
      applicationsApprovedCount: funnel.approvedCount,
      applicationsRejectedCount: funnel.rejectedCount,
      applicationApprovalRatePercentage: funnel.approvalRatePercentage,
    };
  }

  private toExposureSlice(slice: {
    loanCount: number;
    outstandingBalance: number;
  }): StaffDashboardExposureSlice {
    return {
      loanCount: slice.loanCount,
      outstandingPrincipalPlusInterest: slice.outstandingBalance,
    };
  }
}

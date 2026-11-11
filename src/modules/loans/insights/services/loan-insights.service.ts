import { Injectable } from '@nestjs/common';
import type { CustomerDemographicCount } from '../../../users/managed-user/services/managed-user.service';
import { ManagedUserService } from '../../../users/managed-user/services/managed-user.service';
import { LoansService } from '../../records/services/loans.service';
import { RepaymentsService } from '../../repayments/services/repayments.service';
import { LOAN_INSIGHTS_DISTRICT_LIMIT } from '../constants/loan-insights.constant';
import { LoanInsightsQueryDto } from '../dto/insights-query.dto';
import { resolveInsightsFilter } from '../utils/resolve-insights-period.util';

export interface InsightsGenderBreakdownPoint {
  genderId: number | null;
  genderLabel: string;
  customerCount: number;
  percentageShare: number;
}

export interface InsightsDistrictBreakdownPoint {
  districtId: number | null;
  districtName: string;
  customerCount: number;
  percentageShare: number;
}

export interface LoanInsightsSnapshotResponse {
  generatedAt: Date;
  filter: {
    calendarMonth: number | null;
    calendarYear: number;
  };
  monthlyPerformance: {
    dailyBreakdown: Array<{
      date: string;
      loanCount: number;
      totalAmountDisbursed: number;
    }>;
  };
  annualPerformance: {
    monthlyDisbursementTrend: Array<{
      monthNumber: number;
      monthLabel: string;
      loanCount: number;
      totalAmountDisbursed: number;
    }>;
    monthlyRealizedProfitTrend: Array<{
      monthNumber: number;
      monthLabel: string;
      totalProfit: number;
    }>;
  };
  demographics: {
    genderBreakdown: InsightsGenderBreakdownPoint[];
    topDistricts: InsightsDistrictBreakdownPoint[];
  };
}

@Injectable()
export class LoanInsightsService {
  constructor(
    private readonly loansService: LoansService,
    private readonly repaymentsService: RepaymentsService,
    private readonly managedUserService: ManagedUserService,
  ) {}

  /**
   * Current UTC calendar month daily principal disbursements.
   * Empty days are filled with zeros by the underlying series.
   */
  getCurrentUtcMonthDailyDisbursements(
    tenantId: string,
  ): Promise<
    LoanInsightsSnapshotResponse['monthlyPerformance']['dailyBreakdown']
  > {
    const filter = resolveInsightsFilter({});
    if (filter.calendarMonth == null) {
      return Promise.resolve([]);
    }

    return this.loansService.getMonthlyDailyDisbursementVelocity(
      tenantId,
      filter.calendarYear,
      filter.calendarMonth,
    );
  }

  async getSnapshot(
    tenantId: string,
    query: LoanInsightsQueryDto,
  ): Promise<LoanInsightsSnapshotResponse> {
    const filter = resolveInsightsFilter(query);

    const [dailyBreakdown, monthlyDisbursementTrend, monthlyRealizedProfitTrend, demographics] =
      await Promise.all([
        filter.dailyWindow
          ? this.loansService.getMonthlyDailyDisbursementVelocity(
              tenantId,
              filter.calendarYear,
              filter.calendarMonth!,
            )
          : Promise.resolve([]),
        this.loansService.getAnnualMonthlyDisbursementVelocity(
          tenantId,
          filter.calendarYear,
        ),
        this.repaymentsService.getAnnualMonthlyRealizedProfit(
          tenantId,
          filter.calendarYear,
        ),
        this.managedUserService.getDemographicDistribution(
          tenantId,
          LOAN_INSIGHTS_DISTRICT_LIMIT,
        ),
      ]);

    return {
      generatedAt: new Date(),
      filter: {
        calendarMonth: filter.calendarMonth,
        calendarYear: filter.calendarYear,
      },
      monthlyPerformance: { dailyBreakdown },
      annualPerformance: {
        monthlyDisbursementTrend,
        monthlyRealizedProfitTrend,
      },
      demographics: {
        genderBreakdown: this.toGenderPoints(
          demographics.gender.buckets,
          demographics.gender.total,
        ),
        topDistricts: this.toDistrictPoints(
          demographics.districts.buckets,
          demographics.districts.total,
        ),
      },
    };
  }

  private toGenderPoints(
    buckets: CustomerDemographicCount[],
    total: number,
  ): InsightsGenderBreakdownPoint[] {
    return buckets.map((bucket) => ({
      genderId: bucket.id,
      genderLabel: bucket.label,
      customerCount: bucket.count,
      percentageShare: sharePercent(bucket.count, total),
    }));
  }

  private toDistrictPoints(
    buckets: CustomerDemographicCount[],
    total: number,
  ): InsightsDistrictBreakdownPoint[] {
    return buckets.map((bucket) => ({
      districtId: bucket.id,
      districtName: bucket.label,
      customerCount: bucket.count,
      percentageShare: sharePercent(bucket.count, total),
    }));
  }
}

function sharePercent(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 1000) / 10;
}

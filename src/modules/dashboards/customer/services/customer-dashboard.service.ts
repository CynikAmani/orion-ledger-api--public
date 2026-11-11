import { Injectable } from '@nestjs/common';
import { SpecialOfferStatus } from '@prisma/client';
import { PrismaService } from '../../../../core/database/prisma.service';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import type { AuthenticatedUser } from '../../../auth/shared/types/authenticated-user.type';
import { CustomerLoanActivityService } from '../../../customers/loan-activity/services/customer-loan-activity.service';
import { LoanApplicationSettingsService } from '../../../loan-configurations/application-settings/services/loan-application-settings.service';
import {
  InterestRatesService,
  type InterestRateResponse,
} from '../../../loan-configurations/interest-rates/services/interest-rates.service';
import {
  LoanTypesService,
  type LoanTypeResponse,
} from '../../../loan-configurations/loan-types/services/loan-types.service';
import { resolveUserTenantId } from '../../../loan-configurations/shared/utils/resolve-user-tenant.util';
import {
  LoanApplicationsService,
  type LoanApplicationResponse,
} from '../../../loans/applications/services/loan-applications.service';
import {
  LoansService,
  type CustomerOwnedLoanStatusSlice,
  type CustomerOwnedUnclearedLoan,
} from '../../../loans/records/services/loans.service';
import {
  SpecialOffersService,
  type SpecialOfferResponse,
} from '../../../special-offers/services/special-offers.service';

/**
 * Remaining contractual balance: unpaid principal + unpaid interest
 * (loan.returnAmount - sum of repayments).
 */
export interface CustomerDashboardExposureSlice {
  loanCount: number;
  outstandingPrincipalPlusInterest: number;
}

export interface CustomerDashboardUnclearedLoan {
  loanId: string;
  loanTypeId: number;
  loanAmount: number;
  returnAmount: number;
  interestRate: number;
  numWeeks: number;
  startDate: Date;
  endDate: Date;
  status: string;
  amountPaid: number;
  outstandingPrincipalPlusInterest: number;
}

export interface CustomerDashboardActionQueue {
  /** Open loan application rows (approved/declined applications are deleted). */
  openLoanApplicationCount: number;
  openLoanApplications: LoanApplicationResponse[];
  /**
   * Uncleared, not-defaulted loans with endDate before now.
   * May include status ACTIVE when the overdue cron has not run yet.
   */
  unclearedLoansPastEndDateCount: number;
  /** Uncleared, not-defaulted loans whose endDate falls on the current UTC day. */
  unclearedLoansDueTodayUtcCount: number;
  /** Offers in AVAILABLE or RESERVED status after stale expiry. */
  usableSpecialOfferCount: number;
}

/**
 * This customer's full book. Status slices follow Loan.status
 * (ACTIVE / OVERDUE / DEFAULTED / CLEARED).
 */
export interface CustomerDashboardOwnedPortfolio {
  totalLoanCount: number;
  unclearedLoanCount: number;
  outstandingPrincipalPlusInterest: number;
  remainingPrincipal: number;
  remainingInterest: number;
  byStatus: {
    active: CustomerDashboardExposureSlice;
    overdue: CustomerDashboardExposureSlice;
    defaulted: CustomerDashboardExposureSlice;
    cleared: CustomerDashboardExposureSlice;
  };
  unclearedLoans: CustomerDashboardUnclearedLoan[];
}

/**
 * Reward-engine lifetime tallies. Do not bind Active / Overdue / Defaulted /
 * Cleared / My loans widgets here — those use ownedPortfolio (live Loan rows).
 * CustomerLoanActivity.activeLoansCount lumps ACTIVE+OVERDUE and has no
 * current-overdue field (overdueClearedCount is historical).
 */
export interface CustomerDashboardLifetimeActivity {
  applicationsSubmittedCount: number;
  applicationsDeclinedCount: number;
  loansClearedWhileOverdueCount: number;
  loansIssuedSinceLastSpecialOfferCount: number;
  lastSpecialOfferIssuedAt: Date | null;
}

export interface CustomerDashboardProductCatalog {
  minLoanAmount: number;
  maxLoanAmount: number;
  loanTypes: LoanTypeResponse[];
  interestRates: InterestRateResponse[];
}

export interface CustomerDashboardResponse {
  generatedAt: Date;
  /** Null when caller lacks platform:customer:dashboard:action-queue. */
  actionQueue: CustomerDashboardActionQueue | null;
  /** Null when caller lacks platform:customer:dashboard:owned-portfolio. */
  ownedPortfolio: CustomerDashboardOwnedPortfolio | null;
  /** Null when caller lacks platform:customer:dashboard:lifetime-activity. */
  lifetimeActivity: CustomerDashboardLifetimeActivity | null;
  /** Null when caller lacks platform:customer:dashboard:usable-offers. */
  usableSpecialOffers: SpecialOfferResponse[] | null;
  /** Null when caller lacks platform:customer:dashboard:product-catalog. */
  productCatalog: CustomerDashboardProductCatalog | null;
}

const USABLE_OFFER_STATUSES = new Set<SpecialOfferStatus>([
  SpecialOfferStatus.AVAILABLE,
  SpecialOfferStatus.RESERVED,
]);

@Injectable()
export class CustomerDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loansService: LoansService,
    private readonly loanApplicationsService: LoanApplicationsService,
    private readonly specialOffersService: SpecialOffersService,
    private readonly interestRatesService: InterestRatesService,
    private readonly loanTypesService: LoanTypesService,
    private readonly loanApplicationSettingsService: LoanApplicationSettingsService,
    private readonly customerLoanActivityService: CustomerLoanActivityService,
  ) {}

  async getDashboardOverview(
    user: AuthenticatedUser,
  ): Promise<CustomerDashboardResponse> {
    const customerId = user.id;
    const permissions = user.permissions ?? [];

    const canActionQueue = this.has(
      permissions,
      PERMISSIONS.CUSTOMER_DASHBOARD.ACTION_QUEUE,
    );
    const canOwnedPortfolio = this.has(
      permissions,
      PERMISSIONS.CUSTOMER_DASHBOARD.OWNED_PORTFOLIO,
    );
    const canLifetimeActivity = this.has(
      permissions,
      PERMISSIONS.CUSTOMER_DASHBOARD.LIFETIME_ACTIVITY,
    );
    const canUsableOffers = this.has(
      permissions,
      PERMISSIONS.CUSTOMER_DASHBOARD.USABLE_OFFERS,
    );
    const canProductCatalog = this.has(
      permissions,
      PERMISSIONS.CUSTOMER_DASHBOARD.PRODUCT_CATALOG,
    );

    const needsBook = canActionQueue || canOwnedPortfolio;
    const needsOffers = canActionQueue || canUsableOffers;
    const needsCatalog = canProductCatalog;

    // Platform customers have User.tenantId = null; catalog then stays null
    // rather than 403-ing the whole overview envelope.
    let catalogTenantId: string | null = null;
    if (needsCatalog) {
      try {
        catalogTenantId = await resolveUserTenantId(this.prisma, customerId);
      } catch {
        catalogTenantId = null;
      }
    }

    const [
      book,
      openLoanApplications,
      myOffers,
      interestRates,
      loanTypes,
      amountLimits,
      lifetimeActivity,
    ] = await Promise.all([
      needsBook
        ? this.loansService.getCustomerOwnedBookMetrics(customerId)
        : Promise.resolve(null),
      canActionQueue
        ? this.loanApplicationsService.findMine(customerId)
        : Promise.resolve(null),
      needsOffers
        ? this.specialOffersService.getMyOffers(customerId)
        : Promise.resolve(null),
      catalogTenantId
        ? this.interestRatesService.findAll(catalogTenantId, {})
        : Promise.resolve(null),
      catalogTenantId
        ? this.loanTypesService.findAll(catalogTenantId)
        : Promise.resolve(null),
      catalogTenantId
        ? this.loanApplicationSettingsService.getAmountLimits(catalogTenantId)
        : Promise.resolve(null),
      canLifetimeActivity
        ? this.customerLoanActivityService.getByCustomerId(user.userId)
        : Promise.resolve(null),
    ]);

    const usableSpecialOffers = myOffers
      ? myOffers.filter((offer) => USABLE_OFFER_STATUSES.has(offer.status))
      : null;

    return {
      generatedAt: new Date(),
      actionQueue:
        canActionQueue && book && openLoanApplications && usableSpecialOffers
          ? {
              openLoanApplicationCount: openLoanApplications.length,
              openLoanApplications,
              unclearedLoansPastEndDateCount: book.pastEndDateUnclearedLoanCount,
              unclearedLoansDueTodayUtcCount: book.unclearedLoansDueTodayUtcCount,
              usableSpecialOfferCount: usableSpecialOffers.length,
            }
          : null,
      ownedPortfolio:
        canOwnedPortfolio && book
          ? {
              totalLoanCount: book.totalLoanCount,
              unclearedLoanCount: book.unclearedLoanCount,
              outstandingPrincipalPlusInterest: book.outstandingBalance,
              remainingPrincipal: book.principalOutstanding,
              remainingInterest: book.interestOutstanding,
              byStatus: {
                active: this.toExposureSlice(book.byStatus.active),
                overdue: this.toExposureSlice(book.byStatus.overdue),
                defaulted: this.toExposureSlice(book.byStatus.defaulted),
                cleared: this.toExposureSlice(book.byStatus.cleared),
              },
              unclearedLoans: book.unclearedLoans.map((loan) =>
                this.toUnclearedLoan(loan),
              ),
            }
          : null,
      lifetimeActivity: lifetimeActivity
        ? {
            applicationsSubmittedCount: lifetimeActivity.totalApplications,
            applicationsDeclinedCount: lifetimeActivity.rejectedLoansCount,
            loansClearedWhileOverdueCount: lifetimeActivity.overdueClearedCount,
            loansIssuedSinceLastSpecialOfferCount:
              lifetimeActivity.loansSinceLastOffer,
            lastSpecialOfferIssuedAt: lifetimeActivity.lastOfferIssuedAt,
          }
        : null,
      usableSpecialOffers: canUsableOffers ? usableSpecialOffers : null,
      productCatalog:
        canProductCatalog && amountLimits && loanTypes && interestRates
          ? {
              minLoanAmount: amountLimits.minLoanAmount,
              maxLoanAmount: amountLimits.maxLoanAmount,
              loanTypes,
              interestRates,
            }
          : null,
    };
  }

  private has(permissions: string[], permission: string): boolean {
    return permissions.includes(permission);
  }

  private toExposureSlice(
    slice: CustomerOwnedLoanStatusSlice,
  ): CustomerDashboardExposureSlice {
    return {
      loanCount: slice.loanCount,
      outstandingPrincipalPlusInterest: slice.outstandingBalance,
    };
  }

  private toUnclearedLoan(
    loan: CustomerOwnedUnclearedLoan,
  ): CustomerDashboardUnclearedLoan {
    return {
      loanId: loan.loanId,
      loanTypeId: loan.loanTypeId,
      loanAmount: loan.loanAmount,
      returnAmount: loan.returnAmount,
      interestRate: loan.interestRate,
      numWeeks: loan.numWeeks,
      startDate: loan.startDate,
      endDate: loan.endDate,
      status: loan.status,
      amountPaid: loan.amountPaid,
      outstandingPrincipalPlusInterest: loan.outstandingBalance,
    };
  }
}

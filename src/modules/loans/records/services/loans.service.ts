import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { APP_ERROR_CODES } from '../../../../common/exceptions/app-http.exception';
import { formatCurrency } from '../../../../common/utils/format-currency.util';
import {
  addUtcDays,
  utcDayLabel,
  utcDayStart,
  utcMonthLabel,
  utcMonthShortLabelFromIndex,
  utcMonthStart,
  utcMonthWindow,
  utcYearWindow,
} from '../../../../common/utils/format-date.util';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../core/audit/services/audit-emitter.service';
import { SYSTEM_SCHEDULER_AUDIT_CONTEXT } from '../../../../core/audit/utils/audit-request-context.util';
import { PrismaService } from '../../../../core/database/prisma.service';
import { BrevoEmailService } from '../../../../core/email/services/brevo-email.service';
import { loanNoticeFacts } from '../../../../core/notifications/templates/loan-notice-facts.util';
import { UPLOAD_DIRS } from '../../../../core/storage/constants/upload-dirs.constant';
import { ImageStorageService } from '../../../../core/storage/services/image-storage.service';
import { NOTIFICATION_ACTIONS } from '../../../../core/notifications/constants/notification-action-keys.constant';
import { NOTIFICATION_TYPES } from '../../../../core/notifications/constants/notification-type.constant';
import { NotificationDispatcherService } from '../../../../core/notifications/services/notification-dispatcher.service';
import { NotificationsService } from '../../../../core/notifications/services/notifications.service';
import { CustomerLoanActivityService } from '../../../customers/loan-activity/services/customer-loan-activity.service';
import { TenantBrandNameService } from '../../../tenants/shared/services/tenant-brand-name.service';
import { resolveTenantLogoUrl } from '../../../tenants/shared/utils/resolve-tenant-logo-url.util';
import { LoanApplicationSettingsService } from '../../../loan-configurations/application-settings/services/loan-application-settings.service';
import { InterestRatesService } from '../../../loan-configurations/interest-rates/services/interest-rates.service';
import { SpecialOffersService } from '../../../special-offers/services/special-offers.service';
import { UserBusinessEligibilityValidator } from '../../../users/shared/validators/user-business-eligibility.validator';
import { LOAN_APPLICATION_AUDIT_ACTIONS } from '../../applications/constants/loan-application-audit-actions.constant';
import { buildLoanApplicationReceivedEmail } from '../../applications/templates/loan-application-received.email';
import { buildApplicationRateSnapshot } from '../../applications/utils/build-application-rate-snapshot.util';
import {
  allocatePaidToPrincipalAndInterest,
  calculateLoanReturn,
  type OfferDiscountInput,
} from '../../applications/utils/calculate-loan-return.util';
import {
  RepaymentsService,
  type RepaymentResponse,
} from '../../repayments/services/repayments.service';
import {
  RepaymentDetailsService,
  type RepaymentDetailResponse,
} from '../../../repayment-details/services/repayment-details.service';
import type { LoanPeriodWindow } from '../../shared/types/loan-period-window';
import { assertLoanTypeBelongsToTenant } from '../../shared/utils/assert-staff-tenant-record.util';
import { LoanProvisionEligibilityValidator } from '../../shared/validators/loan-provision-eligibility.validator';
import { LOAN_AUDIT_ACTIONS } from '../constants/loan-audit-actions.constant';
import {
  LOAN_BLOCKING_STATUSES,
  LOAN_STATUSES,
  type LoanStatus,
} from '../constants/loan-status.constant';
import { CreateApplicationFromLoanDto } from '../dto/create-application-from-loan.dto';
import { IssueLoanDto } from '../dto/issue-loan.dto';
import { ListLoansQueryDto } from '../dto/list-loans-query.dto';
import { ListMyLoansQueryDto } from '../dto/list-my-loans-query.dto';
import { UpdateLoanDto } from '../dto/update-loan.dto';
import {
  assertLoanOpenForStaffUpdate,
  assertUpdatedReturnExceedsAmountPaid,
} from '../utils/assert-loan-open-for-update.util';
import { loanRecordListOrderBy } from '../utils/loan-record-list-order.util';
import { buildLoanDefaultedEmail } from '../templates/loan-defaulted.email';
import { buildLoanIssuedEmail } from '../templates/loan-issued.email';
import { buildLoanOverdueEmail } from '../templates/loan-overdue.email';
import {
  buildLoanRecordUpdatedEmail,
  buildLoanUpdateChangeLines,
} from '../templates/loan-record-updated.email';

const CUSTOMER_SELECT = {
  userId: true,
  fullname: true,
  email: true,
  phone: true,
} as const;

const HANDLER_SELECT = {
  userId: true,
  fullname: true,
  email: true,
} as const;

const LOAN_TYPE_SELECT = {
  loanTypeId: true,
  typeName: true,
} as const;

const ISSUING_BRAND_SELECT = {
  tenantId: true,
  name: true,
  logoUrl: true,
  brandColor: true,
  brandProfile: {
    select: {
      brandName: true,
      slogan: true,
      logoImgName: true,
    },
  },
} as const;

const LOAN_LIST_SELECT = {
  loanId: true,
  publicId: true,
  tenantId: true,
  customerId: true,
  handlerId: true,
  loanTypeId: true,
  loanAmount: true,
  returnAmount: true,
  interestRate: true,
  numWeeks: true,
  startDate: true,
  endDate: true,
  status: true,
  collateral: true,
  collateralImageUrl: true,
  isCleared: true,
  customer: { select: CUSTOMER_SELECT },
  handler: { select: HANDLER_SELECT },
  loanTypes: { select: LOAN_TYPE_SELECT },
  tenant: { select: ISSUING_BRAND_SELECT },
} as const;

type LoanListRow = Prisma.LoanGetPayload<{ select: typeof LOAN_LIST_SELECT }>;

export interface LoanUserSummary {
  userId: string;
  fullname: string;
  email: string | null;
  phone?: string | null;
}

export interface LoanTypeSummary {
  loanTypeId: number;
  typeName: string;
}

/** Matches applications / special-offers issuingBrand (brandId for FE = tenantId / public uuid). */
export interface LoanIssuingBrand {
  tenantId: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  brandName: string | null;
  slogan: string | null;
  logoImgName: string | null;
}

export type LoanRepaymentResponse = RepaymentResponse;

export interface LoanListItemResponse {
  /** Client-facing alias of publicId — never the internal PK. */
  loanId: string;
  publicId: string;
  tenantId: string;
  customerId: string;
  handlerId: string;
  loanTypeId: number;
  loanAmount: number;
  returnAmount: number;
  interestRate: number;
  numWeeks: number;
  startDate: Date;
  endDate: Date;
  status: string;
  collateral: string;
  collateralImageUrl: string | null;
  isCleared: boolean | null;
  amountPaid: number;
  balance: number;
  customer: LoanUserSummary;
  handler: LoanUserSummary;
  loanType: LoanTypeSummary;
  issuingBrand: LoanIssuingBrand;
}

export interface LoanDetailResponse extends LoanListItemResponse {
  repayments: LoanRepaymentResponse[];
  /** Present on customer mine detail — payment instructions for the issuing institution. */
  repaymentDetails?: RepaymentDetailResponse[];
}

export interface LoansListResponse {
  data: LoanListItemResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LoanRecordResponse {
  /** Internal PK — for FKs and service-to-service only. */
  loanId: string;
  publicId: string;
  tenantId: string;
  customerId: string;
  handlerId: string;
  loanTypeId: number;
  loanAmount: number;
  returnAmount: number;
  interestRate: number;
  numWeeks: number;
  startDate: Date;
  endDate: Date;
  status: string;
  collateral: string;
  collateralImageUrl: string | null;
  isCleared: boolean | null;
}

export interface CreateLoanFromApprovedApplicationInput {
  tenantId: string;
  customerId: number;
  handlerId: number;
  loanTypeId: number;
  loanAmount: number;
  returnAmount: number;
  interestRate: number;
  numWeeks: number;
  collateral: string;
  collateralImageUrl: string | null;
}

export interface RenewLoanResponse {
  clearedLoanId: string;
  newLoan: LoanDetailResponse;
}

export interface ApplicationFromLoanResponse {
  applicationId: number;
  sourceLoanId: string;
}

export interface LoanOverdueStatusBreakdown {
  status: string;
  loanCount: number;
  outstandingBalance: number;
}

/** Live uncleared book. No period filter. No borrower leaderboards. */
export interface LoanOpenBookMetrics {
  unclearedLoanCount: number;
  outstandingBalance: number;
  principalOutstanding: number;
  interestOutstanding: number;
  performingLoanCount: number;
  performingOutstandingBalance: number;
  overdueCount: number;
  overdueVolume: number;
  overdueBreakdown: LoanOverdueStatusBreakdown[];
  defaultedLoanCount: number;
  defaultedOutstandingBalance: number;
}

/** All-time loan book totals (cleared + uncleared). */
export interface LoanCumulativePortfolioMetrics {
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
}

export interface LoanDailyDisbursementPoint {
  date: string;
  loanCount: number;
  totalAmountDisbursed: number;
}

export interface LoanMonthlyDisbursementPoint {
  monthNumber: number;
  monthLabel: string;
  loanCount: number;
  totalAmountDisbursed: number;
}

export type { LoanPeriodWindow };

export interface LoanDisbursementSummary {
  totalDisbursed: number;
  loansIssuedCount: number;
  averageLoanAmount: number;
}

export interface CustomerOwnedLoanStatusSlice {
  loanCount: number;
  outstandingBalance: number;
}

/** Compact uncleared loan row for the customer home screen. */
export interface CustomerOwnedUnclearedLoan {
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
  outstandingBalance: number;
}

/**
 * One customer's full book. Status slices follow Loan.status
 * (ACTIVE / OVERDUE / DEFAULTED / CLEARED), not the staff date partition.
 */
export interface CustomerOwnedBookMetrics {
  totalLoanCount: number;
  unclearedLoanCount: number;
  outstandingBalance: number;
  principalOutstanding: number;
  interestOutstanding: number;
  byStatus: {
    active: CustomerOwnedLoanStatusSlice;
    overdue: CustomerOwnedLoanStatusSlice;
    defaulted: CustomerOwnedLoanStatusSlice;
    cleared: CustomerOwnedLoanStatusSlice;
  };
  /** Uncleared, not defaulted, endDate before now. */
  pastEndDateUnclearedLoanCount: number;
  /** Uncleared, not defaulted, endDate on the current UTC calendar day. */
  unclearedLoansDueTodayUtcCount: number;
  unclearedLoans: CustomerOwnedUnclearedLoan[];
}

export type DisbursementSeriesGranularity = 'day' | 'month';

export interface DisbursementSeriesPoint {
  label: string;
  loanCount: number;
  totalDisbursed: number;
}

export interface LoanVolumeBorrowerRow {
  customerId: string;
  totalIssued: number;
  loansIssuedCount: number;
}

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationDispatcher: NotificationDispatcherService,
    private readonly userBusinessEligibilityValidator: UserBusinessEligibilityValidator,
    private readonly interestRatesService: InterestRatesService,
    private readonly customerLoanActivityService: CustomerLoanActivityService,
    private readonly specialOffersService: SpecialOffersService,
    private readonly loanApplicationSettingsService: LoanApplicationSettingsService,
    private readonly loanProvisionEligibilityValidator: LoanProvisionEligibilityValidator,
    private readonly repaymentDetailsService: RepaymentDetailsService,
    private readonly tenantBrandNameService: TenantBrandNameService,
    private readonly emailService: BrevoEmailService,
    @Inject(forwardRef(() => RepaymentsService))
    private readonly repaymentsService: RepaymentsService,
    private readonly imageStorage: ImageStorageService,
  ) {}

  /**
   * Creates a loan record from an approved application.
   * Owns the Loan model only — callers orchestrate application deletion.
   */
  async createFromApprovedApplication(
    input: CreateLoanFromApprovedApplicationInput,
    db: DbClient = this.prisma,
  ): Promise<LoanRecordResponse> {
    return this.insertLoan(
      {
        ...input,
        status: LOAN_STATUSES.ACTIVE,
        isCleared: false,
      },
      db,
    );
  }

  async findAll(
    tenantId: string,
    query: ListLoansQueryDto,
  ): Promise<LoansListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = await this.buildStaffWhere(tenantId, query);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.loan.count({ where }),
      this.prisma.loan.findMany({
        where,
        select: LOAN_LIST_SELECT,
        orderBy: loanRecordListOrderBy(query.status),
        skip,
        take: limit,
      }),
    ]);

    const moneyByLoanId = await this.repaymentsService.sumByLoanIds(
      rows.map((row) => row.loanId),
    );

    return {
      data: rows.map((row) => this.toListItem(row, moneyByLoanId)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async findOne(
    tenantId: string,
    publicId: string,
  ): Promise<LoanDetailResponse> {
    const row = await this.assertLoanInTenant(tenantId, publicId);
    return this.toDetail(row);
  }

  /**
   * Staff correction of an open loan. Term dates stay; returnAmount is
   * recomputed from the submitted amount + rate snapshot. Collateral photo
   * is replaced only when a file is sent.
   */
  async update(
    tenantId: string,
    publicId: string,
    dto: UpdateLoanDto,
    auditContext: AuditContext,
    file?: Express.Multer.File,
  ): Promise<LoanDetailResponse> {
    const existing = await this.assertLoanInTenant(tenantId, publicId);
    assertLoanOpenForStaffUpdate(existing);

    await this.loanApplicationSettingsService.assertLoanAmountWithinLimits(
      tenantId,
      dto.loanAmount,
    );

    const loanType = await this.prisma.loanType.findUnique({
      where: { loanTypeId: dto.loanTypeId },
      select: { tenantId: true, typeName: true },
    });

    if (!loanType) {
      throw new NotFoundException(`Loan type ${dto.loanTypeId} was not found`);
    }

    assertLoanTypeBelongsToTenant(loanType.tenantId, tenantId);

    const { interestRate, returnAmount } = calculateLoanReturn({
      loanAmount: dto.loanAmount,
      activeRate: dto.interestRate,
    });

    const amountPaid = await this.repaymentsService.getAmountPaid(
      existing.loanId,
    );
    assertUpdatedReturnExceedsAmountPaid(returnAmount, amountPaid);

    const nextImageUrl = file
      ? await this.imageStorage.save(file, UPLOAD_DIRS.LOAN_RECORD_COLLATERAL)
      : undefined;
    const previousImageUrl = existing.collateralImageUrl;

    try {
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.loan.findFirst({
          where: { publicId, tenantId },
          select: {
            loanId: true,
            status: true,
            isCleared: true,
          },
        });

        if (!current) {
          throw new NotFoundException(`Loan ${publicId} was not found`);
        }

        assertLoanOpenForStaffUpdate(current);

        const paidInsideTx = await this.repaymentsService.getAmountPaid(
          current.loanId,
          tx,
        );
        assertUpdatedReturnExceedsAmountPaid(returnAmount, paidInsideTx);

        await tx.loan.update({
          where: { loanId: current.loanId },
          data: {
            loanTypeId: dto.loanTypeId,
            loanAmount: dto.loanAmount,
            interestRate,
            returnAmount,
            collateral: dto.collateral,
            ...(nextImageUrl !== undefined
              ? { collateralImageUrl: nextImageUrl }
              : {}),
          },
        });
      });

      if (nextImageUrl && nextImageUrl !== previousImageUrl) {
        await this.imageStorage.deleteIfExists(previousImageUrl);
      }
    } catch (error) {
      await this.imageStorage.deleteIfExists(nextImageUrl ?? null);
      throw error;
    }

    const brandName =
      await this.tenantBrandNameService.resolveDisplayName(tenantId);
    const nextImageUrlRecorded = nextImageUrl ?? previousImageUrl;
    const changes = buildLoanUpdateChangeLines({
      before: {
        loanTypeName: existing.loanTypes.typeName,
        loanAmount: existing.loanAmount,
        returnAmount: existing.returnAmount,
        interestRate: existing.interestRate,
        collateral: existing.collateral,
        collateralImageUrl: previousImageUrl,
      },
      after: {
        loanTypeName: loanType.typeName,
        loanAmount: dto.loanAmount,
        returnAmount,
        interestRate,
        collateral: dto.collateral,
        collateralImageUrl: nextImageUrlRecorded,
      },
      balance: returnAmount - amountPaid,
    });

    this.notificationsService.push({
      targetUser: existing.customerId,
      type: NOTIFICATION_TYPES.INFO,
      content: `Dear ${existing.customer.fullname}, your loan (${publicId}) was updated. Amount: ${formatCurrency(dto.loanAmount)}, rate: ${interestRate}%. Regards, ${brandName}.`,
    });

    if (existing.customer.email && changes.length > 0) {
      const emailContent = buildLoanRecordUpdatedEmail({
        fullname: existing.customer.fullname,
        brandName,
        changes,
        remainingBalance: returnAmount - amountPaid,
        loanTypeName: loanType.typeName,
      });
      this.sendCustomerEmail(existing.customer.email, emailContent);
    }

    this.emitAudit(auditContext, {
      tenantId,
      action: LOAN_AUDIT_ACTIONS.UPDATED,
      targetId: publicId,
      payload: {
        before: {
          loanTypeId: existing.loanTypeId,
          loanAmount: existing.loanAmount,
          interestRate: existing.interestRate,
          returnAmount: existing.returnAmount,
          collateral: existing.collateral,
          collateralImageUrl: previousImageUrl,
        },
        after: {
          loanTypeId: dto.loanTypeId,
          loanAmount: dto.loanAmount,
          interestRate,
          returnAmount,
          collateral: dto.collateral,
          collateralImageUrl: nextImageUrl ?? previousImageUrl,
        },
        collateralImageReplaced: Boolean(nextImageUrl),
      },
    });

    return this.findOne(tenantId, publicId);
  }

  async findMine(
    customerId: number,
    query: ListMyLoansQueryDto,
  ): Promise<LoansListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.LoanWhereInput = {
      customerId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.loan.count({ where }),
      this.prisma.loan.findMany({
        where,
        select: LOAN_LIST_SELECT,
        orderBy: loanRecordListOrderBy(query.status),
        skip,
        take: limit,
      }),
    ]);

    const moneyByLoanId = await this.repaymentsService.sumByLoanIds(
      rows.map((row) => row.loanId),
    );

    return {
      data: rows.map((row) => this.toListItem(row, moneyByLoanId)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async findOneMine(
    customerId: number,
    publicId: string,
  ): Promise<LoanDetailResponse> {
    const row = await this.assertOwnedLoan(publicId, customerId);
    const [detail, repaymentDetails] = await Promise.all([
      this.toDetail(row),
      this.repaymentDetailsService.findAll(row.tenantId),
    ]);

    return {
      ...detail,
      repaymentDetails,
    };
  }

  /**
   * One customer's live book: status totals, outstanding, and uncleared rows.
   */
  async getCustomerOwnedBookMetrics(
    customerId: number,
  ): Promise<CustomerOwnedBookMetrics> {
    const now = new Date();
    const todayStart = utcDayStart(now);
    const todayEndExclusive = addUtcDays(todayStart, 1);

    const loans = await this.prisma.loan.findMany({
      where: { customerId },
      select: {
        loanId: true,
        publicId: true,
        loanTypeId: true,
        loanAmount: true,
        returnAmount: true,
        interestRate: true,
        numWeeks: true,
        startDate: true,
        endDate: true,
        status: true,
        isCleared: true,
      },
      orderBy: { startDate: 'desc' },
    });

    const paidByLoanId = await this.repaymentsService.sumByLoanIds(
      loans.map((loan) => loan.loanId),
    );

    const byStatus = {
      active: emptyOwnedStatusSlice(),
      overdue: emptyOwnedStatusSlice(),
      defaulted: emptyOwnedStatusSlice(),
      cleared: emptyOwnedStatusSlice(),
    };

    let outstandingBalance = 0;
    let principalOutstanding = 0;
    let interestOutstanding = 0;
    let unclearedLoanCount = 0;
    let pastEndDateUnclearedLoanCount = 0;
    let unclearedLoansDueTodayUtcCount = 0;
    const unclearedLoans: CustomerOwnedUnclearedLoan[] = [];

    for (const loan of loans) {
      const amountPaid = paidByLoanId.get(loan.loanId) ?? 0;
      const balance = Math.max(0, loan.returnAmount - amountPaid);
      const statusKey = loan.status.toUpperCase();
      const cleared =
        statusKey === LOAN_STATUSES.CLEARED || loan.isCleared === true;

      if (cleared) {
        byStatus.cleared.loanCount += 1;
        continue;
      }

      const allocated = allocatePaidToPrincipalAndInterest({
        amountPaid,
        loanAmount: loan.loanAmount,
        returnAmount: loan.returnAmount,
      });
      outstandingBalance += balance;
      principalOutstanding += Math.max(
        0,
        loan.loanAmount - allocated.principalPaid,
      );
      interestOutstanding += Math.max(
        0,
        loan.returnAmount - loan.loanAmount - allocated.interestPaid,
      );
      unclearedLoanCount += 1;

      if (statusKey === LOAN_STATUSES.DEFAULTED) {
        byStatus.defaulted.loanCount += 1;
        byStatus.defaulted.outstandingBalance += balance;
      } else if (statusKey === LOAN_STATUSES.OVERDUE) {
        byStatus.overdue.loanCount += 1;
        byStatus.overdue.outstandingBalance += balance;
      } else {
        byStatus.active.loanCount += 1;
        byStatus.active.outstandingBalance += balance;
      }

      if (statusKey !== LOAN_STATUSES.DEFAULTED && loan.endDate < now) {
        pastEndDateUnclearedLoanCount += 1;
      }

      if (
        statusKey !== LOAN_STATUSES.DEFAULTED &&
        loan.endDate >= todayStart &&
        loan.endDate < todayEndExclusive
      ) {
        unclearedLoansDueTodayUtcCount += 1;
      }

      unclearedLoans.push({
        loanId: loan.publicId,
        loanTypeId: loan.loanTypeId,
        loanAmount: loan.loanAmount,
        returnAmount: loan.returnAmount,
        interestRate: loan.interestRate,
        numWeeks: loan.numWeeks,
        startDate: loan.startDate,
        endDate: loan.endDate,
        status: loan.status,
        amountPaid,
        outstandingBalance: balance,
      });
    }

    return {
      totalLoanCount: loans.length,
      unclearedLoanCount,
      outstandingBalance,
      principalOutstanding,
      interestOutstanding,
      byStatus,
      pastEndDateUnclearedLoanCount,
      unclearedLoansDueTodayUtcCount,
      unclearedLoans,
    };
  }

  /**
   * Live uncleared book for the portfolio orchestrator.
   * No period filter and no borrower leaderboards.
   */
  async getOpenBookMetrics(tenantId: string): Promise<LoanOpenBookMetrics> {
    const now = new Date();
    const loans = await this.prisma.loan.findMany({
      where: this.unclearedWhere(tenantId),
      select: {
        loanId: true,
        loanAmount: true,
        returnAmount: true,
        status: true,
        endDate: true,
      },
    });

    const paidByLoanId = await this.repaymentsService.sumByLoanIds(
      loans.map((loan) => loan.loanId),
    );

    const overdueByStatus = new Map<
      string,
      { loanCount: number; outstandingBalance: number }
    >();

    let outstandingBalance = 0;
    let principalOutstanding = 0;
    let interestOutstanding = 0;
    let performingLoanCount = 0;
    let performingOutstandingBalance = 0;
    let overdueCount = 0;
    let overdueVolume = 0;
    let defaultedLoanCount = 0;
    let defaultedOutstandingBalance = 0;

    for (const loan of loans) {
      const amountPaid = paidByLoanId.get(loan.loanId) ?? 0;
      const balance = Math.max(0, loan.returnAmount - amountPaid);
      const allocated = allocatePaidToPrincipalAndInterest({
        amountPaid,
        loanAmount: loan.loanAmount,
        returnAmount: loan.returnAmount,
      });
      outstandingBalance += balance;
      principalOutstanding += Math.max(
        0,
        loan.loanAmount - allocated.principalPaid,
      );
      interestOutstanding += Math.max(
        0,
        loan.returnAmount - loan.loanAmount - allocated.interestPaid,
      );

      const statusKey = loan.status.toUpperCase();

      if (statusKey === LOAN_STATUSES.DEFAULTED) {
        defaultedLoanCount += 1;
        defaultedOutstandingBalance += balance;
      } else if (loan.endDate < now) {
        overdueCount += 1;
        overdueVolume += balance;
        const bucket = overdueByStatus.get(statusKey) ?? {
          loanCount: 0,
          outstandingBalance: 0,
        };
        bucket.loanCount += 1;
        bucket.outstandingBalance += balance;
        overdueByStatus.set(statusKey, bucket);
      } else {
        performingLoanCount += 1;
        performingOutstandingBalance += balance;
      }
    }

    const overdueBreakdown = [...overdueByStatus.entries()]
      .map(([status, bucket]) => ({ status, ...bucket }))
      .sort(
        (left, right) => right.outstandingBalance - left.outstandingBalance,
      );

    return {
      unclearedLoanCount: loans.length,
      outstandingBalance,
      principalOutstanding,
      interestOutstanding,
      performingLoanCount,
      performingOutstandingBalance,
      overdueCount,
      overdueVolume,
      overdueBreakdown,
      defaultedLoanCount,
      defaultedOutstandingBalance,
    };
  }

  /**
   * Uncleared, not-defaulted loans whose contractual endDate falls on the
   * given UTC calendar day (default: today). Includes loans already past the
   * exact endDate timestamp today — those also sit in the overdue slice.
   */
  async countUnclearedLoansDueOnUtcDay(
    tenantId: string,
    day: Date = new Date(),
  ): Promise<number> {
    const start = utcDayStart(day);
    const endExclusive = addUtcDays(start, 1);

    return this.prisma.loan.count({
      where: {
        tenantId,
        status: {
          notIn: [LOAN_STATUSES.CLEARED, LOAN_STATUSES.DEFAULTED],
        },
        NOT: { isCleared: true },
        endDate: { gte: start, lt: endExclusive },
      },
    });
  }

  /**
   * All-time book. Written-off is always zero: the schema has no write-off status.
   */
  async getCumulativePortfolioMetrics(
    tenantId: string,
  ): Promise<LoanCumulativePortfolioMetrics> {
    const now = new Date();
    const loans = await this.prisma.loan.findMany({
      where: { tenantId },
      select: {
        loanId: true,
        loanAmount: true,
        returnAmount: true,
        status: true,
        isCleared: true,
        endDate: true,
      },
    });

    const paidByLoanId = await this.repaymentsService.sumByLoanIds(
      loans.map((loan) => loan.loanId),
    );

    let totalAmountDisbursed = 0;
    let totalLoansClearedCount = 0;
    let totalAmountCleared = 0;
    let activeStatusLoanCount = 0;
    let activeStatusOutstandingBalance = 0;
    let overdueLoanCount = 0;
    let overdueOutstandingBalance = 0;
    let defaultedLoanCount = 0;
    let defaultedOutstandingBalance = 0;

    for (const loan of loans) {
      totalAmountDisbursed += loan.loanAmount;
      const amountPaid = paidByLoanId.get(loan.loanId) ?? 0;
      const balance = Math.max(0, loan.returnAmount - amountPaid);
      const statusKey = loan.status.toUpperCase();
      const cleared =
        statusKey === LOAN_STATUSES.CLEARED || loan.isCleared === true;

      if (cleared) {
        totalLoansClearedCount += 1;
        totalAmountCleared += loan.loanAmount;
        continue;
      }

      if (statusKey === LOAN_STATUSES.DEFAULTED) {
        defaultedLoanCount += 1;
        defaultedOutstandingBalance += balance;
        continue;
      }

      if (statusKey === LOAN_STATUSES.ACTIVE) {
        activeStatusLoanCount += 1;
        activeStatusOutstandingBalance += balance;
      }

      if (loan.endDate < now) {
        overdueLoanCount += 1;
        overdueOutstandingBalance += balance;
      }
    }

    return {
      totalLoansDisbursedCount: loans.length,
      totalAmountDisbursed,
      totalLoansClearedCount,
      totalAmountCleared,
      activeStatusLoanCount,
      activeStatusOutstandingBalance,
      overdueLoanCount,
      overdueOutstandingBalance,
      defaultedLoanCount,
      defaultedOutstandingBalance,
      writtenOffLoanCount: 0,
      writtenOffVolume: 0,
    };
  }

  async getMonthlyDailyDisbursementVelocity(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<LoanDailyDisbursementPoint[]> {
    const series = await this.getDisbursementSeries(
      tenantId,
      utcMonthWindow(year, month),
      'day',
    );

    return series.map((point) => ({
      date: point.label,
      loanCount: point.loanCount,
      totalAmountDisbursed: point.totalDisbursed,
    }));
  }

  async getAnnualMonthlyDisbursementVelocity(
    tenantId: string,
    year: number,
  ): Promise<LoanMonthlyDisbursementPoint[]> {
    const series = await this.getDisbursementSeries(
      tenantId,
      utcYearWindow(year),
      'month',
    );

    return series.map((point) => {
      const monthNumber = Number(point.label.slice(5, 7));
      return {
        monthNumber,
        monthLabel: utcMonthShortLabelFromIndex(monthNumber - 1),
        loanCount: point.loanCount,
        totalAmountDisbursed: point.totalDisbursed,
      };
    });
  }

  /**
   * Issued-loan capital in the window, from Loan.startDate (not applications).
   */
  async getDisbursementSummary(
    tenantId: string,
    window: LoanPeriodWindow,
  ): Promise<LoanDisbursementSummary> {
    const aggregate = await this.prisma.loan.aggregate({
      where: { tenantId, startDate: this.periodFilter(window) },
      _sum: { loanAmount: true },
      _count: true,
    });

    const loansIssuedCount = aggregate._count;
    const totalDisbursed = aggregate._sum.loanAmount ?? 0;
    const averageLoanAmount =
      loansIssuedCount === 0
        ? 0
        : Math.round(totalDisbursed / loansIssuedCount);

    return { totalDisbursed, loansIssuedCount, averageLoanAmount };
  }

  /**
   * Chart-ready disbursement series for issued loans in the window.
   * Empty days/months are filled with zeros so the frontend can plot continuously.
   */
  async getDisbursementSeries(
    tenantId: string,
    window: LoanPeriodWindow,
    granularity: DisbursementSeriesGranularity,
  ): Promise<DisbursementSeriesPoint[]> {
    const loans = await this.prisma.loan.findMany({
      where: { tenantId, startDate: this.periodFilter(window) },
      select: { startDate: true, loanAmount: true },
    });

    const buckets = this.emptyDisbursementBuckets(window, granularity);

    for (const loan of loans) {
      const label =
        granularity === 'day'
          ? utcDayLabel(loan.startDate)
          : utcMonthLabel(loan.startDate);
      const bucket = buckets.get(label);
      if (!bucket) {
        continue;
      }
      bucket.loanCount += 1;
      bucket.totalDisbursed += loan.loanAmount;
    }

    return [...buckets.entries()].map(([label, point]) => ({
      label,
      loanCount: point.loanCount,
      totalDisbursed: point.totalDisbursed,
    }));
  }

  async getTopBorrowersByIssuedVolume(
    tenantId: string,
    window: LoanPeriodWindow,
    topLimit: number,
  ): Promise<LoanVolumeBorrowerRow[]> {
    const groups = await this.prisma.loan.groupBy({
      by: ['customerId'],
      where: { tenantId, startDate: this.periodFilter(window) },
      _sum: { loanAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { loanAmount: 'desc' } },
      take: topLimit,
    });

    const handleById = await this.mapUserIdsToHandles(
      groups.map((group) => group.customerId),
    );

    return groups.map((group) => ({
      customerId: handleById.get(group.customerId) ?? String(group.customerId),
      totalIssued: group._sum.loanAmount ?? 0,
      loansIssuedCount: group._count._all,
    }));
  }

  async issue(
    tenantId: string,
    handlerId: number,
    dto: IssueLoanDto,
    auditContext: AuditContext,
  ): Promise<LoanDetailResponse> {
    await this.userBusinessEligibilityValidator.assertUserAccountIsNotBlocked(
      dto.customerId,
    );
    const customer = await this.resolveCustomerByHandle(dto.customerId);
    await this.loanProvisionEligibilityValidator.assertLoanProvisionEligibility(
      customer.id,
      handlerId,
    );
    await this.loanApplicationSettingsService.assertLoanAmountWithinLimits(
      tenantId,
      dto.loanAmount,
    );

    const rate = await this.interestRatesService.findByNumWeeks(
      tenantId,
      dto.numWeeks,
    );
    const { interestRate, returnAmount } = calculateLoanReturn({
      loanAmount: dto.loanAmount,
      activeRate: rate.activeRate,
    });

    const loan = await this.prisma.$transaction(async (tx) => {
      const created = await this.insertLoan(
        {
          tenantId,
          customerId: customer.id,
          handlerId,
          loanTypeId: rate.loanTypeId,
          loanAmount: dto.loanAmount,
          returnAmount,
          interestRate,
          numWeeks: dto.numWeeks,
          collateral: dto.collateral,
          collateralImageUrl: null,
          status: LOAN_STATUSES.ACTIVE,
          isCleared: false,
        },
        tx,
      );

      await this.customerLoanActivityService.recordLoanIssued(
        customer.id,
        tenantId,
        tx,
      );

      return created;
    });

    const detail = await this.findOne(tenantId, loan.publicId);
    const brandName =
      await this.tenantBrandNameService.resolveDisplayName(tenantId);

    this.notificationsService.push({
      targetUser: customer.id,
      type: NOTIFICATION_TYPES.INFO,
      content: `Dear ${customer.fullname}, a loan of ${formatCurrency(dto.loanAmount)} has been issued to you. Regards, ${brandName}.`,
    });

    this.sendCustomerEmail(
      detail.customer.email,
      buildLoanIssuedEmail({
        fullname: detail.customer.fullname,
        brandName,
        loanAmount: detail.loanAmount,
        returnAmount: detail.returnAmount,
        interestRate: detail.interestRate,
        numWeeks: detail.numWeeks,
        startDate: detail.startDate,
        endDate: detail.endDate,
        loanTypeName: detail.loanType.typeName,
        collateral: detail.collateral,
      }),
    );

    this.dispatchLoanIssued(
      detail,
      brandName,
      `A loan of ${formatCurrency(dto.loanAmount)} was issued to ${customer.fullname}.`,
    );

    this.emitAudit(auditContext, {
      tenantId,
      action: LOAN_AUDIT_ACTIONS.ISSUED,
      targetId: loan.publicId,
      payload: {
        customerId: dto.customerId,
        handlerId,
        loanAmount: dto.loanAmount,
        returnAmount,
        numWeeks: dto.numWeeks,
      },
    });

    return detail;
  }

  async renew(
    tenantId: string,
    publicId: string,
    handlerId: number,
    auditContext: AuditContext,
  ): Promise<RenewLoanResponse> {
    const renewed = await this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { publicId, tenantId },
        select: LOAN_LIST_SELECT,
      });

      if (!loan) {
        throw new NotFoundException(`Loan ${publicId} was not found`);
      }

      const amountPaid = await this.repaymentsService.getAmountPaid(
        loan.loanId,
        tx,
      );
      const balance = loan.returnAmount - amountPaid;

      const { interestRate, expectedReturnAmount: returnAmount } =
        await this.snapshotFromSourceProductStandard({
          tenantId,
          loanTypeId: loan.loanTypeId,
          numWeeks: loan.numWeeks,
          loanAmount: loan.loanAmount,
        });

      let settlementRepaymentId: string | null = null;

      if (loan.status !== LOAN_STATUSES.CLEARED && !loan.isCleared) {
        if (balance > 0) {
          settlementRepaymentId = await this.repaymentsService.create(
            {
              loanId: loan.loanId,
              handlerId,
              amountPaid: balance,
            },
            tx,
          );
        }
        await this.markCleared(loan, tx);
      }

      const created = await this.insertLoan(
        {
          tenantId,
          customerId: loan.customerId,
          handlerId,
          loanTypeId: loan.loanTypeId,
          loanAmount: loan.loanAmount,
          returnAmount,
          interestRate,
          numWeeks: loan.numWeeks,
          collateral: loan.collateral,
          collateralImageUrl: loan.collateralImageUrl,
          status: LOAN_STATUSES.ACTIVE,
          isCleared: false,
        },
        tx,
      );

      await this.customerLoanActivityService.recordLoanIssued(
        loan.customerId,
        tenantId,
        tx,
      );

      return {
        newPublicId: created.publicId,
        previousStatus: loan.status,
        settlementRepaymentId,
        customerId: loan.customerId,
        loanAmount: loan.loanAmount,
        numWeeks: loan.numWeeks,
      };
    });

    const newLoan = await this.findOne(tenantId, renewed.newPublicId);
    const brandName =
      await this.tenantBrandNameService.resolveDisplayName(tenantId);

    this.notificationsService.push({
      targetUser: renewed.customerId,
      type: NOTIFICATION_TYPES.INFO,
      content: `Dear ${newLoan.customer.fullname}, your loan has been renewed. New loan ID: ${newLoan.loanId}. Regards, ${brandName}.`,
    });

    this.sendCustomerEmail(
      newLoan.customer.email,
      buildLoanIssuedEmail({
        fullname: newLoan.customer.fullname,
        brandName,
        loanAmount: newLoan.loanAmount,
        returnAmount: newLoan.returnAmount,
        interestRate: newLoan.interestRate,
        numWeeks: newLoan.numWeeks,
        startDate: newLoan.startDate,
        endDate: newLoan.endDate,
        loanTypeName: newLoan.loanType.typeName,
        collateral: newLoan.collateral,
      }),
    );

    this.dispatchLoanIssued(
      newLoan,
      brandName,
      `A renewed loan of ${formatCurrency(newLoan.loanAmount)} was issued to ${newLoan.customer.fullname}.`,
    );

    this.auditEmitter.emitRelated(
      {
        ...auditContext,
        tenantId,
        module: 'LOANS',
        targetType: 'Loan',
        action: LOAN_AUDIT_ACTIONS.RENEWED,
        targetId: publicId,
        payload: {
          newLoanId: renewed.newPublicId,
          handlerId,
          settlementRepaymentId: renewed.settlementRepaymentId,
          ...(renewed.previousStatus !== LOAN_STATUSES.CLEARED
            ? {
                previousStatus: renewed.previousStatus,
                status: LOAN_STATUSES.CLEARED,
              }
            : {}),
        },
      },
      {
        module: 'LOANS',
        action: LOAN_AUDIT_ACTIONS.ISSUED,
        targetType: 'Loan',
        targetId: renewed.newPublicId,
        payload: {
          sourceLoanId: publicId,
          origin: 'renew',
          customerId: renewed.customerId,
          handlerId,
          loanAmount: renewed.loanAmount,
          numWeeks: renewed.numWeeks,
        },
      },
    );

    return { clearedLoanId: publicId, newLoan };
  }

  async duplicate(
    tenantId: string,
    publicId: string,
    handlerId: number,
    auditContext: AuditContext,
  ): Promise<LoanDetailResponse> {
    const source = await this.assertLoanInTenant(tenantId, publicId);

    await this.userBusinessEligibilityValidator.assertUserAccountIsNotBlocked(
      source.customer.userId,
    );

    const { interestRate, expectedReturnAmount: returnAmount } =
      await this.snapshotFromSourceProductStandard({
        tenantId,
        loanTypeId: source.loanTypeId,
        numWeeks: source.numWeeks,
        loanAmount: source.loanAmount,
      });

    const created = await this.prisma.$transaction(async (tx) => {
      const loan = await this.insertLoan(
        {
          tenantId,
          customerId: source.customerId,
          handlerId,
          loanTypeId: source.loanTypeId,
          loanAmount: source.loanAmount,
          returnAmount,
          interestRate,
          numWeeks: source.numWeeks,
          collateral: source.collateral,
          collateralImageUrl: source.collateralImageUrl,
          status: LOAN_STATUSES.ACTIVE,
          isCleared: false,
        },
        tx,
      );

      await this.customerLoanActivityService.recordLoanIssued(
        source.customerId,
        tenantId,
        tx,
      );

      return loan;
    });

    const brandName =
      await this.tenantBrandNameService.resolveDisplayName(tenantId);

    const issued = await this.findOne(tenantId, created.publicId);

    this.notificationsService.push({
      targetUser: source.customerId,
      type: NOTIFICATION_TYPES.INFO,
      content: `Dear ${source.customer.fullname}, a parallel loan of ${formatCurrency(source.loanAmount)} has been issued. Regards, ${brandName}.`,
    });

    this.sendCustomerEmail(
      issued.customer.email,
      buildLoanIssuedEmail({
        fullname: issued.customer.fullname,
        brandName,
        loanAmount: issued.loanAmount,
        returnAmount: issued.returnAmount,
        interestRate: issued.interestRate,
        numWeeks: issued.numWeeks,
        startDate: issued.startDate,
        endDate: issued.endDate,
        loanTypeName: issued.loanType.typeName,
        collateral: issued.collateral,
      }),
    );

    this.dispatchLoanIssued(
      issued,
      brandName,
      `A parallel loan of ${formatCurrency(source.loanAmount)} was issued to ${source.customer.fullname}.`,
    );

    this.auditEmitter.emitRelated(
      {
        ...auditContext,
        tenantId,
        module: 'LOANS',
        targetType: 'Loan',
        action: LOAN_AUDIT_ACTIONS.DUPLICATED,
        targetId: publicId,
        payload: { newLoanId: created.publicId, handlerId },
      },
      {
        module: 'LOANS',
        action: LOAN_AUDIT_ACTIONS.ISSUED,
        targetType: 'Loan',
        targetId: created.publicId,
        payload: {
          sourceLoanId: publicId,
          origin: 'duplicate',
          customerId: source.customerId,
          handlerId,
          loanAmount: source.loanAmount,
          numWeeks: source.numWeeks,
        },
      },
    );

    return issued;
  }

  async markDefaulted(
    tenantId: string,
    publicId: string,
    auditContext: AuditContext,
  ): Promise<LoanDetailResponse> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { publicId, tenantId },
        select: LOAN_LIST_SELECT,
      });

      if (!loan) {
        throw new NotFoundException(`Loan ${publicId} was not found`);
      }

      if (loan.status === LOAN_STATUSES.CLEARED || loan.isCleared) {
        throw new BadRequestException('A cleared loan cannot be defaulted');
      }

      if (loan.status === LOAN_STATUSES.DEFAULTED) {
        throw new BadRequestException('This loan is already defaulted');
      }

      await tx.loan.update({
        where: { loanId: loan.loanId },
        data: { status: LOAN_STATUSES.DEFAULTED },
      });

      await this.customerLoanActivityService.recordLoanDefaulted(
        loan.customerId,
        loan.tenantId,
        tx,
      );

      await tx.user.update({
        where: { id: loan.customerId },
        data: { isBlocked: true },
      });

      return loan;
    });

    const brandName =
      await this.tenantBrandNameService.resolveDisplayName(tenantId);
    const amountPaid = await this.repaymentsService.getAmountPaid(
      updated.loanId,
    );
    const remainingBalance = updated.returnAmount - amountPaid;

    this.notificationsService.push({
      targetUser: updated.customerId,
      type: NOTIFICATION_TYPES.ALERT,
      content: `Dear ${updated.customer.fullname}, your loan (${publicId}) has been marked as defaulted. Please contact ${brandName}.`,
    });

    this.sendCustomerEmail(
      updated.customer.email,
      buildLoanDefaultedEmail({
        fullname: updated.customer.fullname,
        brandName,
        remainingBalance,
        loanAmount: updated.loanAmount,
        returnAmount: updated.returnAmount,
        dueDate: updated.endDate,
        loanTypeName: updated.loanTypes.typeName,
      }),
    );

    void this.notificationDispatcher.dispatch(
      NOTIFICATION_ACTIONS.LOANS.DEFAULTED,
      {
        subject: 'Loan defaulted',
        message: `Loan ${publicId} for ${updated.customer.fullname} was marked defaulted.`,
        templateData: loanNoticeFacts({
          organization: brandName,
          customerName: updated.customer.fullname,
          loanTypeName: updated.loanTypes.typeName,
          loanAmount: updated.loanAmount,
          returnAmount: updated.returnAmount,
          remainingBalance,
          dueDate: updated.endDate,
        }),
      },
      { tenantId },
    );

    this.emitAudit(auditContext, {
      tenantId,
      action: LOAN_AUDIT_ACTIONS.DEFAULTED,
      targetId: publicId,
      payload: {
        previousStatus: updated.status,
        status: LOAN_STATUSES.DEFAULTED,
        customerId: updated.customerId,
      },
    });

    return this.findOne(tenantId, publicId);
  }

  async renewAsApplication(
    customerId: number,
    publicId: string,
    dto: CreateApplicationFromLoanDto,
    auditContext: AuditContext,
  ): Promise<ApplicationFromLoanResponse> {
    const loan = await this.assertOwnedLoan(publicId, customerId);

    if (loan.status !== LOAN_STATUSES.CLEARED && !loan.isCleared) {
      throw new BadRequestException(
        'Only a cleared loan can be renewed as an application',
      );
    }

    return this.createApplicationFromLoan(
      customerId,
      loan,
      dto,
      auditContext,
      LOAN_AUDIT_ACTIONS.RENEW_APPLICATION_CREATED,
    );
  }

  async duplicateAsApplication(
    customerId: number,
    publicId: string,
    dto: CreateApplicationFromLoanDto,
    auditContext: AuditContext,
  ): Promise<ApplicationFromLoanResponse> {
    const loan = await this.assertOwnedLoan(publicId, customerId);

    if (loan.status === LOAN_STATUSES.CLEARED || loan.isCleared === true) {
      throw new BadRequestException(
        'Use renew for a cleared loan; duplicate is for active, overdue, or defaulted loans',
      );
    }

    const allowed: string[] = [
      LOAN_STATUSES.ACTIVE,
      LOAN_STATUSES.OVERDUE,
      LOAN_STATUSES.DEFAULTED,
    ];

    if (!allowed.includes(loan.status)) {
      throw new BadRequestException(
        'This loan cannot be duplicated as an application',
      );
    }

    return this.createApplicationFromLoan(
      customerId,
      loan,
      dto,
      auditContext,
      LOAN_AUDIT_ACTIONS.DUPLICATE_APPLICATION_CREATED,
    );
  }

  /** Cron: ACTIVE loans past endDate → OVERDUE + block customer. */
  async syncOverdueLifecycle(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.loan.findMany({
      where: {
        status: LOAN_STATUSES.ACTIVE,
        isCleared: false,
        endDate: { lt: now },
      },
      select: {
        loanId: true,
        publicId: true,
        tenantId: true,
        customerId: true,
        returnAmount: true,
        endDate: true,
        customer: { select: { userId: true, fullname: true, email: true } },
        loanTypes: { select: { typeName: true } },
      },
    });

    const brandByTenant = new Map<string, string>();

    for (const loan of due) {
      await this.prisma.$transaction(async (tx) => {
        await tx.loan.update({
          where: { loanId: loan.loanId },
          data: { status: LOAN_STATUSES.OVERDUE },
        });
        await tx.user.update({
          where: { id: loan.customerId },
          data: { isBlocked: true },
        });
      });

      const amountPaid = await this.repaymentsService.getAmountPaid(
        loan.loanId,
      );
      const remainingBalance = loan.returnAmount - amountPaid;
      let brandName = brandByTenant.get(loan.tenantId);
      if (!brandName) {
        brandName = await this.tenantBrandNameService.resolveDisplayName(
          loan.tenantId,
        );
        brandByTenant.set(loan.tenantId, brandName);
      }

      this.notificationsService.push({
        targetUser: loan.customerId,
        type: NOTIFICATION_TYPES.WARNING,
        content: `Dear ${loan.customer.fullname}, your loan (${loan.publicId}) with ${brandName} is now overdue. Please arrange repayment.`,
      });

      this.sendCustomerEmail(
        loan.customer.email,
        buildLoanOverdueEmail({
          fullname: loan.customer.fullname,
          brandName,
          remainingBalance,
          amountPaidToDate: amountPaid,
          returnAmount: loan.returnAmount,
          dueDate: loan.endDate,
          loanTypeName: loan.loanTypes.typeName,
        }),
      );

      void this.notificationDispatcher.dispatch(
        NOTIFICATION_ACTIONS.LOANS.OVERDUE,
        {
          subject: 'Loan overdue',
          message: `Loan ${loan.publicId} for ${loan.customer.fullname} is overdue.`,
          templateData: loanNoticeFacts({
            organization: brandName,
            customerName: loan.customer.fullname,
            loanTypeName: loan.loanTypes.typeName,
            returnAmount: loan.returnAmount,
            amountPaidToDate: amountPaid,
            remainingBalance,
            dueDate: loan.endDate,
          }),
        },
        { tenantId: loan.tenantId },
      );

      this.emitAudit(SYSTEM_SCHEDULER_AUDIT_CONTEXT, {
        tenantId: loan.tenantId,
        action: LOAN_AUDIT_ACTIONS.MARKED_OVERDUE,
        targetId: loan.publicId,
        payload: {
          previousStatus: LOAN_STATUSES.ACTIVE,
          status: LOAN_STATUSES.OVERDUE,
          customerId: loan.customer.userId,
        },
      });
    }
  }

  /**
   * One-shot backfill of status + isCleared from repayments and endDate.
   * Safe to re-run; does not create repayments.
   */
  async reconcileStatusesFromRepayments(
    tenantId: string,
  ): Promise<{ updated: number }> {
    const loans = await this.prisma.loan.findMany({
      where: { tenantId },
      select: {
        loanId: true,
        customerId: true,
        returnAmount: true,
        endDate: true,
        status: true,
        isCleared: true,
      },
    });

    const moneyByLoanId = await this.repaymentsService.sumByLoanIds(
      loans.map((loan) => loan.loanId),
    );

    const now = new Date();
    let updated = 0;

    for (const loan of loans) {
      const amountPaid = moneyByLoanId.get(loan.loanId) ?? 0;
      const balance = loan.returnAmount - amountPaid;
      let nextStatus: LoanStatus;
      let nextCleared: boolean;

      if (balance <= 0 || loan.isCleared === true) {
        nextStatus = LOAN_STATUSES.CLEARED;
        nextCleared = true;
      } else if (
        loan.status === LOAN_STATUSES.DEFAULTED ||
        loan.status?.toLowerCase() === 'defaulted'
      ) {
        nextStatus = LOAN_STATUSES.DEFAULTED;
        nextCleared = false;
      } else if (loan.endDate < now) {
        nextStatus = LOAN_STATUSES.OVERDUE;
        nextCleared = false;
      } else {
        nextStatus = LOAN_STATUSES.ACTIVE;
        nextCleared = false;
      }

      if (loan.status !== nextStatus || loan.isCleared !== nextCleared) {
        await this.prisma.loan.update({
          where: { loanId: loan.loanId },
          data: { status: nextStatus, isCleared: nextCleared },
        });
        updated += 1;
      }
    }

    this.emitAudit(SYSTEM_SCHEDULER_AUDIT_CONTEXT, {
      tenantId,
      action: LOAN_AUDIT_ACTIONS.RECONCILED,
      targetId: 'bulk',
      payload: { updated, total: loans.length },
    });

    return { updated };
  }

  private async createApplicationFromLoan(
    customerId: number,
    loan: LoanListRow,
    dto: CreateApplicationFromLoanDto,
    auditContext: AuditContext,
    auditAction: string,
  ): Promise<ApplicationFromLoanResponse> {
    const customerHandle = loan.customer.userId;
    await this.userBusinessEligibilityValidator.assertUserAccountIsNotBlocked(
      customerHandle,
    );
    await this.loanProvisionEligibilityValidator.assertUserAgreementsAccepted(
      customerId,
      {
        errorCode: APP_ERROR_CODES.CUSTOMER_AGREEMENTS_NOT_ACCEPTED,
        message:
          'You must accept the current Terms of Service and Privacy Policy before continuing',
      },
    );
    const tenantId = loan.tenantId;
    await this.loanProvisionEligibilityValidator.assertUserTenantAgreementsAccepted(
      customerId,
      tenantId,
    );
    await this.loanApplicationSettingsService.assertLoanAmountWithinLimits(
      tenantId,
      loan.loanAmount,
    );

    const submitted = await this.prisma.$transaction(async (tx) => {
      let specialOfferId: number | null = null;
      let discount = 0;
      let offerDiscount: OfferDiscountInput | null = null;

      if (dto.offerId !== undefined) {
        const snapshot =
          await this.specialOffersService.validateForApplicationAttachment(
            dto.offerId,
            customerId,
            tx,
          );
        if (snapshot.tenantId !== tenantId) {
          throw new BadRequestException(
            'Special offer does not belong to the selected financial institution',
          );
        }
        const reserved = await this.specialOffersService.reserveForApplication(
          dto.offerId,
          customerId,
          tx,
        );
        specialOfferId = reserved.id;
        discount = reserved.discountValue;
        offerDiscount = {
          discountType: reserved.discountType,
          discountValue: reserved.discountValue,
        };
      }

      const rateSnapshot = await this.snapshotFromSourceProductStandard({
        tenantId,
        loanTypeId: loan.loanTypeId,
        numWeeks: loan.numWeeks,
        loanAmount: loan.loanAmount,
        offer: offerDiscount,
      });

      const created = await tx.loanApplication.create({
        data: {
          tenantId,
          applicantId: customerId,
          loanAmount: loan.loanAmount,
          collateral: loan.collateral,
          collateralImageUrl: loan.collateralImageUrl,
          numWeeks: loan.numWeeks,
          location: dto.location,
          discount,
          specialOfferId,
          isReviewed: false,
          loanTypeId: rateSnapshot.loanTypeId,
          activeRate: rateSnapshot.activeRate,
          interestRate: rateSnapshot.interestRate,
          expectedReturnAmount: rateSnapshot.expectedReturnAmount,
        },
        select: { id: true },
      });

      await this.customerLoanActivityService.recordApplicationSubmitted(
        customerId,
        tenantId,
        tx,
      );

      return { created, rateSnapshot };
    });

    const application = submitted.created;
    const rateSnapshot = submitted.rateSnapshot;

    const brandName =
      await this.tenantBrandNameService.resolveDisplayName(tenantId);
    const submittedAt = new Date();

    this.sendCustomerEmail(
      loan.customer.email,
      buildLoanApplicationReceivedEmail({
        fullname: loan.customer.fullname,
        brandName,
        loanAmount: loan.loanAmount,
        numWeeks: loan.numWeeks,
        expectedReturnAmount: rateSnapshot.expectedReturnAmount,
        interestRate: rateSnapshot.interestRate,
        loanTypeName: loan.loanTypes.typeName,
      }),
    );

    void this.notificationDispatcher.dispatch(
      NOTIFICATION_ACTIONS.LOAN_APPLICATIONS.SUBMITTED,
      {
        subject: 'New loan application',
        message: `${loan.customer.fullname} submitted a loan application derived from loan ${loan.publicId}.`,
        templateData: {
          ...loanNoticeFacts({
            organization: brandName,
            customerName: loan.customer.fullname,
            loanTypeName: loan.loanTypes.typeName,
            loanAmount: loan.loanAmount,
            returnAmount: rateSnapshot.expectedReturnAmount,
            interestRate: rateSnapshot.interestRate,
            numWeeks: loan.numWeeks,
            location: dto.location,
            collateral: loan.collateral,
            submittedAt,
          }),
          applicationId: application.id,
          sourceLoanId: loan.publicId,
        },
      },
      { tenantId },
    );

    this.auditEmitter.emitRelated(
      {
        ...auditContext,
        tenantId,
        module: 'LOAN_APPLICATIONS',
        targetType: 'LoanApplication',
        action: LOAN_APPLICATION_AUDIT_ACTIONS.CREATED,
        targetId: String(application.id),
        payload: {
          sourceLoanId: loan.publicId,
          customerId,
          loanAmount: loan.loanAmount,
          numWeeks: loan.numWeeks,
        },
      },
      {
        module: 'LOANS',
        action: auditAction,
        targetType: 'Loan',
        targetId: loan.publicId,
        payload: {
          applicationId: application.id,
          customerId,
          loanAmount: loan.loanAmount,
          numWeeks: loan.numWeeks,
        },
      },
    );

    return {
      applicationId: application.id,
      sourceLoanId: loan.publicId,
    };
  }

  async markCleared(
    loan: {
      loanId: string;
      customerId: number;
      status: string;
      tenantId: string;
    },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const previousStatus = loan.status;

    await tx.loan.update({
      where: { loanId: loan.loanId },
      data: {
        status: LOAN_STATUSES.CLEARED,
        isCleared: true,
      },
    });

    await this.customerLoanActivityService.recordLoanCleared(
      loan.customerId,
      previousStatus,
      loan.tenantId,
      tx,
    );

    await this.maybeUnblockCustomer(loan.customerId, tx);
  }

  private async maybeUnblockCustomer(
    customerId: number,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const blocking = await tx.loan.count({
      where: {
        customerId,
        status: { in: LOAN_BLOCKING_STATUSES },
        isCleared: false,
      },
    });

    if (blocking === 0) {
      await tx.user.update({
        where: { id: customerId },
        data: { isBlocked: false },
      });
    }
  }

  /**
   * Renew/duplicate (and from-loan applications) keep the source product
   * (loanTypeId + numWeeks) but reprice at catalog standardRate.
   * That ignores the source loan's frozen rate (ended promo / redeemed offer)
   * and ignores a live promotion's activeRate.
   */
  private async snapshotFromSourceProductStandard(params: {
    tenantId: string;
    loanTypeId: number;
    numWeeks: number;
    loanAmount: number;
    offer?: OfferDiscountInput | null;
  }) {
    const rate = await this.interestRatesService.findByLoanTypeAndNumWeeks(
      params.tenantId,
      params.loanTypeId,
      params.numWeeks,
    );

    return buildApplicationRateSnapshot({
      loanTypeId: rate.loanTypeId,
      activeRate: rate.standardRate,
      loanAmount: params.loanAmount,
      offer: params.offer,
    });
  }

  private async insertLoan(
    input: CreateLoanFromApprovedApplicationInput & {
      status: string;
      isCleared: boolean;
    },
    db: DbClient,
  ): Promise<LoanRecordResponse> {
    const loanType = await db.loanType.findUnique({
      where: { loanTypeId: input.loanTypeId },
      select: { tenantId: true },
    });

    if (!loanType) {
      throw new NotFoundException(
        `Loan type ${input.loanTypeId} was not found`,
      );
    }

    assertLoanTypeBelongsToTenant(loanType.tenantId, input.tenantId);

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + input.numWeeks * 7);
    const publicId = randomUUID();

    const created = await db.loan.create({
      data: {
        loanId: randomUUID(),
        publicId,
        tenantId: input.tenantId,
        customerId: input.customerId,
        handlerId: input.handlerId,
        loanTypeId: input.loanTypeId,
        loanAmount: input.loanAmount,
        returnAmount: input.returnAmount,
        interestRate: input.interestRate,
        numWeeks: input.numWeeks,
        startDate,
        endDate,
        status: input.status,
        collateral: input.collateral,
        collateralImageUrl: input.collateralImageUrl,
        isCleared: input.isCleared,
      },
      select: {
        loanId: true,
        publicId: true,
        tenantId: true,
        loanTypeId: true,
        loanAmount: true,
        returnAmount: true,
        interestRate: true,
        numWeeks: true,
        startDate: true,
        endDate: true,
        status: true,
        collateral: true,
        collateralImageUrl: true,
        isCleared: true,
        customer: { select: { userId: true } },
        handler: { select: { userId: true } },
      },
    });

    return {
      loanId: created.loanId,
      publicId: created.publicId,
      tenantId: created.tenantId,
      customerId: created.customer.userId,
      handlerId: created.handler.userId,
      loanTypeId: created.loanTypeId,
      loanAmount: created.loanAmount,
      returnAmount: created.returnAmount,
      interestRate: created.interestRate,
      numWeeks: created.numWeeks,
      startDate: created.startDate,
      endDate: created.endDate,
      status: created.status,
      collateral: created.collateral,
      collateralImageUrl: created.collateralImageUrl,
      isCleared: created.isCleared,
    };
  }

  private async buildStaffWhere(
    tenantId: string,
    query: ListLoansQueryDto,
  ): Promise<Prisma.LoanWhereInput> {
    const where: Prisma.LoanWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.loanTypeId ? { loanTypeId: query.loanTypeId } : {}),
    };

    const term = query.search?.trim();
    if (!term) {
      return where;
    }

    where.OR = [
      { publicId: { contains: term, mode: 'insensitive' } },
      {
        customer: {
          OR: [
            { fullname: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
          ],
        },
      },
    ];

    return where;
  }

  private unclearedWhere(tenantId?: string): Prisma.LoanWhereInput {
    return {
      ...(tenantId ? { tenantId } : {}),
      status: { not: LOAN_STATUSES.CLEARED },
      NOT: { isCleared: true },
    };
  }

  private periodFilter(window: LoanPeriodWindow): Prisma.DateTimeFilter {
    return { gte: window.start, lt: window.endExclusive };
  }

  private emptyDisbursementBuckets(
    window: LoanPeriodWindow,
    granularity: DisbursementSeriesGranularity,
  ): Map<string, { loanCount: number; totalDisbursed: number }> {
    const buckets = new Map<
      string,
      { loanCount: number; totalDisbursed: number }
    >();

    if (granularity === 'day') {
      const cursor = new Date(window.start.getTime());
      while (cursor < window.endExclusive) {
        buckets.set(utcDayLabel(cursor), { loanCount: 0, totalDisbursed: 0 });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return buckets;
    }

    const cursor = utcMonthStart(window.start);
    while (cursor < window.endExclusive) {
      buckets.set(utcMonthLabel(cursor), { loanCount: 0, totalDisbursed: 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    return buckets;
  }

  private async assertLoanInTenant(
    tenantId: string,
    publicId: string,
  ): Promise<LoanListRow> {
    const loan = await this.prisma.loan.findFirst({
      where: { publicId, tenantId },
      select: LOAN_LIST_SELECT,
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${publicId} was not found`);
    }

    return loan;
  }

  private async assertOwnedLoan(
    publicId: string,
    customerId: number,
  ): Promise<LoanListRow> {
    const loan = await this.prisma.loan.findFirst({
      where: { publicId, customerId },
      select: LOAN_LIST_SELECT,
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${publicId} was not found`);
    }

    return loan;
  }

  private async toDetail(row: LoanListRow): Promise<LoanDetailResponse> {
    const [amountPaid, repayments] = await Promise.all([
      this.repaymentsService.getAmountPaid(row.loanId),
      this.repaymentsService.listForResolvedLoan(row.loanId),
    ]);

    return {
      ...this.toListItem(row, new Map([[row.loanId, amountPaid]])),
      repayments,
    };
  }

  private toListItem(
    row: LoanListRow,
    moneyByLoanId: Map<string, number>,
  ): LoanListItemResponse {
    const amountPaid = moneyByLoanId.get(row.loanId) ?? 0;

    return {
      loanId: row.publicId,
      publicId: row.publicId,
      tenantId: row.tenantId,
      customerId: row.customer.userId,
      handlerId: row.handler.userId,
      loanTypeId: row.loanTypeId,
      loanAmount: row.loanAmount,
      returnAmount: row.returnAmount,
      interestRate: row.interestRate,
      numWeeks: row.numWeeks,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
      collateral: row.collateral,
      collateralImageUrl: row.collateralImageUrl,
      isCleared: row.isCleared,
      amountPaid,
      balance: row.returnAmount - amountPaid,
      customer: {
        userId: row.customer.userId,
        fullname: row.customer.fullname,
        email: row.customer.email,
        phone: row.customer.phone,
      },
      handler: {
        userId: row.handler.userId,
        fullname: row.handler.fullname,
        email: row.handler.email,
      },
      loanType: {
        loanTypeId: row.loanTypes.loanTypeId,
        typeName: row.loanTypes.typeName,
      },
      issuingBrand: {
        tenantId: row.tenant.tenantId,
        name: row.tenant.name,
        logoUrl: resolveTenantLogoUrl({
          logoUrl: row.tenant.logoUrl,
          logoImgName: row.tenant.brandProfile?.logoImgName,
        }),
        brandColor: row.tenant.brandColor,
        brandName: row.tenant.brandProfile?.brandName ?? null,
        slogan: row.tenant.brandProfile?.slogan ?? null,
        logoImgName: row.tenant.brandProfile?.logoImgName ?? null,
      },
    };
  }

  private async resolveCustomerByHandle(handle: string): Promise<{
    id: number;
    userId: string;
    fullname: string;
    email: string | null;
    phone: string | null;
  }> {
    const customer = await this.prisma.user.findFirst({
      where: { userId: handle, deletedAt: null },
      select: { id: true, ...CUSTOMER_SELECT },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${handle} was not found`);
    }

    return customer;
  }

  private async mapUserIdsToHandles(
    ids: number[],
  ): Promise<Map<number, string>> {
    if (ids.length === 0) {
      return new Map();
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, userId: true },
    });

    return new Map(users.map((user) => [user.id, user.userId]));
  }

  private dispatchLoanIssued(
    detail: LoanDetailResponse,
    brandName: string,
    message: string,
  ): void {
    void this.notificationDispatcher.dispatch(
      NOTIFICATION_ACTIONS.LOANS.ISSUED,
      {
        subject: 'Loan issued',
        message,
        templateData: loanNoticeFacts({
          organization: brandName,
          customerName: detail.customer.fullname,
          loanTypeName: detail.loanType.typeName,
          loanAmount: detail.loanAmount,
          returnAmount: detail.returnAmount,
          interestRate: detail.interestRate,
          numWeeks: detail.numWeeks,
          startDate: detail.startDate,
          dueDate: detail.endDate,
          collateral: detail.collateral,
        }),
      },
      { tenantId: detail.tenantId },
    );
  }

  private sendCustomerEmail(
    to: string | null | undefined,
    content: { subject: string; html: string; text: string },
  ): void {
    if (!to) {
      return;
    }

    void this.emailService.send({
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
  }

  private emitAudit(
    auditContext: AuditContext,
    params: {
      tenantId: string;
      action: string;
      targetId: string;
      payload?: Record<string, unknown>;
    },
  ): void {
    this.auditEmitter.emit({
      ...auditContext,
      tenantId: params.tenantId,
      module: 'LOANS',
      targetType: 'Loan',
      action: params.action,
      targetId: params.targetId,
      payload: params.payload,
    });
  }
}

function emptyOwnedStatusSlice(): CustomerOwnedLoanStatusSlice {
  return { loanCount: 0, outstandingBalance: 0 };
}

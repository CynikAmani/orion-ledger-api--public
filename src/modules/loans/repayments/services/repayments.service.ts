import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { formatCurrency } from '../../../../common/utils/format-currency.util';
import {
  utcMonthShortLabelFromIndex,
  utcYearWindow,
} from '../../../../common/utils/format-date.util';
import { allocatePaidToPrincipalAndInterest } from '../../applications/utils/calculate-loan-return.util';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import { BrevoEmailService } from '../../../../core/email/services/brevo-email.service';
import { NOTIFICATION_ACTIONS } from '../../../../core/notifications/constants/notification-action-keys.constant';
import { NOTIFICATION_TYPES } from '../../../../core/notifications/constants/notification-type.constant';
import { loanNoticeFacts } from '../../../../core/notifications/templates/loan-notice-facts.util';
import { NotificationDispatcherService } from '../../../../core/notifications/services/notification-dispatcher.service';
import { NotificationsService } from '../../../../core/notifications/services/notifications.service';
import { TenantBrandNameService } from '../../../tenants/shared/services/tenant-brand-name.service';
import { LOAN_AUDIT_ACTIONS } from '../../records/constants/loan-audit-actions.constant';
import { LOAN_STATUSES } from '../../records/constants/loan-status.constant';
import {
  LoansService,
  type LoanDetailResponse,
} from '../../records/services/loans.service';
import type { LoanPeriodWindow } from '../../shared/types/loan-period-window';
import { REPAYMENT_AUDIT_ACTIONS } from '../constants/repayment-audit-actions.constant';
import { buildLoanRepaymentRecordedEmail } from '../templates/loan-repayment-recorded.email';

const HANDLER_SELECT = {
  userId: true,
  fullname: true,
  email: true,
} as const;

const REPAYMENT_SELECT = {
  repaymentId: true,
  handlerId: true,
  loanId: true,
  amountPaid: true,
  datePaid: true,
  users: { select: HANDLER_SELECT },
  loans: { select: { publicId: true } },
} as const;

const LOAN_FOR_REPAYMENT_SELECT = {
  loanId: true,
  publicId: true,
  tenantId: true,
  customerId: true,
  status: true,
  isCleared: true,
  returnAmount: true,
  loanAmount: true,
} as const;

type DbClient = Prisma.TransactionClient | PrismaService;

export interface RepaymentHandlerSummary {
  userId: string;
  fullname: string;
  email: string | null;
}

export interface RepaymentResponse {
  repaymentId: string;
  handlerId: string;
  loanId: string;
  amountPaid: number;
  datePaid: Date;
  handler: RepaymentHandlerSummary;
}

export interface RecordRepaymentResponse {
  loan: LoanDetailResponse;
  repaymentId: string;
  newBalance: number;
  cleared: boolean;
}

export interface CashFlowYield {
  totalCollected: number;
  principalRepaid: number;
  interestEarned: number;
  penaltiesCollected: number;
}

export interface ActiveBorrowerRow {
  customerId: string;
  repaymentCount: number;
  amountCollected: number;
  completedLoanCount: number;
}

export interface MonthlyRealizedProfitPoint {
  monthNumber: number;
  monthLabel: string;
  totalProfit: number;
}

@Injectable()
export class RepaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationDispatcher: NotificationDispatcherService,
    private readonly emailService: BrevoEmailService,
    private readonly tenantBrandNameService: TenantBrandNameService,
    @Inject(forwardRef(() => LoansService))
    private readonly loansService: LoansService,
  ) {}

  async listByLoanId(
    tenantId: string,
    loanPublicId: string,
  ): Promise<RepaymentResponse[]> {
    const loan = await this.assertLoanInTenant(tenantId, loanPublicId);
    return this.findRepaymentsForLoan(loan.loanId);
  }

  /**
   * Service-to-service: list repayments for an already-resolved internal loan PK.
   */
  async listForResolvedLoan(loanId: string): Promise<RepaymentResponse[]> {
    return this.findRepaymentsForLoan(loanId);
  }

  /** Customer self-service — repayment history for a loan they own (by publicId). */
  async listMineByLoanId(
    customerId: number,
    loanPublicId: string,
  ): Promise<RepaymentResponse[]> {
    const loan = await this.prisma.loan.findFirst({
      where: { publicId: loanPublicId, customerId },
      select: { loanId: true },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${loanPublicId} was not found`);
    }

    return this.findRepaymentsForLoan(loan.loanId);
  }

  private async findRepaymentsForLoan(
    loanId: string,
  ): Promise<RepaymentResponse[]> {
    const rows = await this.prisma.repayment.findMany({
      where: { loanId },
      select: REPAYMENT_SELECT,
      orderBy: { datePaid: 'desc' },
    });

    return rows.map((row) => this.toResponse(row));
  }

  private async assertLoanInTenant(
    tenantId: string,
    loanPublicId: string,
  ): Promise<{
    loanId: string;
    publicId: string;
    tenantId: string;
    customerId: number;
    status: string;
    isCleared: boolean | null;
    returnAmount: number;
    loanAmount: number;
  }> {
    const loan = await this.prisma.loan.findFirst({
      where: {
        publicId: loanPublicId,
        tenantId,
      },
      select: LOAN_FOR_REPAYMENT_SELECT,
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${loanPublicId} was not found`);
    }

    return loan;
  }

  async getAmountPaid(
    loanId: string,
    db: DbClient = this.prisma,
  ): Promise<number> {
    const aggregate = await db.repayment.aggregate({
      where: { loanId },
      _sum: { amountPaid: true },
    });
    return aggregate._sum.amountPaid ?? 0;
  }

  async sumByLoanIds(loanIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (loanIds.length === 0) {
      return map;
    }

    const groups = await this.prisma.repayment.groupBy({
      by: ['loanId'],
      where: { loanId: { in: loanIds } },
      _sum: { amountPaid: true },
    });

    for (const group of groups) {
      map.set(group.loanId, group._sum.amountPaid ?? 0);
    }

    return map;
  }

  async create(
    input: {
      loanId: string;
      handlerId: number;
      amountPaid: number;
      datePaid?: Date;
    },
    db: DbClient = this.prisma,
  ): Promise<string> {
    const repaymentId = randomUUID();
    await db.repayment.create({
      data: {
        repaymentId,
        handlerId: input.handlerId,
        loanId: input.loanId,
        amountPaid: input.amountPaid,
        datePaid: input.datePaid ?? new Date(),
      },
    });
    return repaymentId;
  }

  /**
   * Staff installment against a loan. Clearance of the loan record is delegated
   * to LoansService when the remaining balance hits zero.
   */
  async record(
    tenantId: string,
    loanPublicId: string,
    handlerId: number,
    amount: number,
    auditContext: AuditContext,
  ): Promise<RecordRepaymentResponse> {
    const result = await this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findFirst({
        where: {
          publicId: loanPublicId,
          tenantId,
        },
        select: LOAN_FOR_REPAYMENT_SELECT,
      });

      if (!loan) {
        throw new NotFoundException(`Loan ${loanPublicId} was not found`);
      }

      if (loan.status === LOAN_STATUSES.CLEARED || loan.isCleared) {
        throw new BadRequestException('This loan is already cleared');
      }

      const amountPaid = await this.getAmountPaid(loan.loanId, tx);
      const balance = loan.returnAmount - amountPaid;

      if (amount > balance) {
        throw new BadRequestException(
          'The amount to be paid cannot be greater than the remaining balance',
        );
      }

      const repaymentId = await this.create(
        { loanId: loan.loanId, handlerId, amountPaid: amount },
        tx,
      );

      const newBalance = balance - amount;
      let cleared = false;

      if (newBalance === 0) {
        cleared = true;
        await this.loansService.markCleared(loan, tx);
      }

      return {
        repaymentId,
        newBalance,
        cleared,
        customerId: loan.customerId,
        publicId: loan.publicId,
        previousStatus: loan.status,
      };
    });

    const detail = await this.loansService.findOne(tenantId, result.publicId);
    const brandName =
      await this.tenantBrandNameService.resolveDisplayName(tenantId);

    this.notificationsService.push({
      targetUser: result.customerId,
      type: NOTIFICATION_TYPES.INFO,
      content: result.cleared
        ? `Dear ${detail.customer.fullname}, a repayment of ${formatCurrency(amount)} has been recorded. Your loan has been cleared. Thank you.`
        : `Dear ${detail.customer.fullname}, a repayment of ${formatCurrency(amount)} has been recorded. Remaining balance is ${formatCurrency(result.newBalance)}. Thank you.`,
    });

    if (detail.customer.email) {
      const emailContent = buildLoanRepaymentRecordedEmail({
        fullname: detail.customer.fullname,
        brandName,
        repaidAmount: amount,
        remainingBalance: result.newBalance,
        amountPaidToDate: detail.amountPaid,
        returnAmount: detail.returnAmount,
        dueDate: detail.endDate,
        loanTypeName: detail.loanType.typeName,
        cleared: result.cleared,
      });
      void this.emailService.send({
        to: detail.customer.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
    }

    const repaymentFacts = loanNoticeFacts({
      organization: brandName,
      customerName: detail.customer.fullname,
      loanTypeName: detail.loanType.typeName,
      loanAmount: detail.loanAmount,
      returnAmount: detail.returnAmount,
      repaidAmount: amount,
      amountPaidToDate: detail.amountPaid,
      remainingBalance: result.newBalance,
      dueDate: detail.endDate,
      cleared: result.cleared,
    });

    void this.notificationDispatcher.dispatch(
      NOTIFICATION_ACTIONS.REPAYMENTS.RECORDED,
      {
        subject: 'Loan repayment recorded',
        message: `Repayment of ${formatCurrency(amount)} recorded for ${detail.customer.fullname} at ${brandName}.`,
        templateData: repaymentFacts,
      },
      { tenantId },
    );

    if (result.cleared) {
      void this.notificationDispatcher.dispatch(
        NOTIFICATION_ACTIONS.LOANS.CLEARED,
        {
          subject: 'Loan cleared',
          message: `Loan ${loanPublicId} for ${detail.customer.fullname} has been cleared.`,
          templateData: repaymentFacts,
        },
        { tenantId },
      );
    }

    this.auditEmitter.emitRelated(
      {
        ...auditContext,
        tenantId,
        module: 'REPAYMENTS',
        targetType: 'Repayment',
        action: REPAYMENT_AUDIT_ACTIONS.RECORDED,
        targetId: result.repaymentId,
        payload: {
          loanId: loanPublicId,
          amount,
          newBalance: result.newBalance,
          cleared: result.cleared,
          handlerId,
        },
      },
      {
        module: 'LOANS',
        action: LOAN_AUDIT_ACTIONS.REPAYMENT_RECORDED,
        targetType: 'Loan',
        targetId: loanPublicId,
        payload: {
          amount,
          newBalance: result.newBalance,
          cleared: result.cleared,
          handlerId,
          ...(result.cleared
            ? {
                previousStatus: result.previousStatus,
                status: LOAN_STATUSES.CLEARED,
              }
            : {}),
        },
      },
    );

    return {
      loan: detail,
      repaymentId: result.repaymentId,
      newBalance: result.newBalance,
      cleared: result.cleared,
    };
  }

  /**
   * Cash collected in the window by datePaid (not isCleared).
   * Principal vs interest is pro-rata from each loan's loanAmount / returnAmount.
   */
  async getCashFlowYield(
    tenantId: string,
    window: LoanPeriodWindow,
  ): Promise<CashFlowYield> {
    const repayments = await this.prisma.repayment.findMany({
      where: {
        datePaid: this.periodFilter(window),
        loans: { tenantId },
      },
      select: {
        amountPaid: true,
        loans: {
          select: {
            loanAmount: true,
            returnAmount: true,
          },
        },
      },
    });

    let totalCollected = 0;
    let principalRepaid = 0;
    let interestEarned = 0;

    for (const row of repayments) {
      totalCollected += row.amountPaid;
      const split = allocatePaidToPrincipalAndInterest({
        amountPaid: row.amountPaid,
        loanAmount: row.loans.loanAmount,
        returnAmount: row.loans.returnAmount,
      });
      principalRepaid += split.principalPaid;
      interestEarned += split.interestPaid;
    }

    return {
      totalCollected,
      principalRepaid,
      interestEarned,
      penaltiesCollected: 0,
    };
  }

  /**
   * Contractual interest (returnAmount - loanAmount) of loans that cleared,
   * attributed to the UTC month of their last repayment. Schema has no
   * clearedAt column.
   */
  async getAnnualMonthlyRealizedProfit(
    tenantId: string,
    year: number,
  ): Promise<MonthlyRealizedProfitPoint[]> {
    const window = utcYearWindow(year);
    const points = Array.from({ length: 12 }, (_, index) => ({
      monthNumber: index + 1,
      monthLabel: utcMonthShortLabelFromIndex(index),
      totalProfit: 0,
    }));

    const clearedLoans = await this.prisma.loan.findMany({
      where: {
        tenantId,
        OR: [{ status: LOAN_STATUSES.CLEARED }, { isCleared: true }],
      },
      select: {
        loanAmount: true,
        returnAmount: true,
        repayments: {
          select: { datePaid: true },
          orderBy: { datePaid: 'desc' },
          take: 1,
        },
      },
    });

    for (const loan of clearedLoans) {
      const lastPaid = loan.repayments[0]?.datePaid;
      if (
        !lastPaid ||
        lastPaid < window.start ||
        lastPaid >= window.endExclusive
      ) {
        continue;
      }

      const monthIndex = lastPaid.getUTCMonth();
      points[monthIndex].totalProfit += Math.max(
        0,
        loan.returnAmount - loan.loanAmount,
      );
    }

    return points;
  }

  /**
   * Activity from repayments in the window. A loan is completed in-period when
   * cumulative cash first reaches returnAmount on a datePaid inside the window.
   */
  async getMostActiveBorrowers(
    tenantId: string,
    window: LoanPeriodWindow,
    topLimit: number,
  ): Promise<ActiveBorrowerRow[]> {
    const repayments = await this.prisma.repayment.findMany({
      where: {
        datePaid: this.periodFilter(window),
        loans: { tenantId },
      },
      select: {
        loanId: true,
        amountPaid: true,
        datePaid: true,
        loans: {
          select: {
            customerId: true,
            returnAmount: true,
          },
        },
      },
      orderBy: [{ datePaid: 'asc' }, { repaymentId: 'asc' }],
    });

    const loanIds = [...new Set(repayments.map((row) => row.loanId))];
    const priorByLoanId = await this.sumByLoanIdsBefore(loanIds, window.start);

    const runningByLoanId = new Map<string, number>();
    const byCustomer = new Map<
      number,
      {
        repaymentCount: number;
        amountCollected: number;
        completedLoanIds: Set<string>;
      }
    >();

    for (const row of repayments) {
      const customer = byCustomer.get(row.loans.customerId) ?? {
        repaymentCount: 0,
        amountCollected: 0,
        completedLoanIds: new Set<string>(),
      };
      customer.repaymentCount += 1;
      customer.amountCollected += row.amountPaid;

      const before =
        runningByLoanId.get(row.loanId) ?? priorByLoanId.get(row.loanId) ?? 0;
      const after = before + row.amountPaid;
      runningByLoanId.set(row.loanId, after);

      if (before < row.loans.returnAmount && after >= row.loans.returnAmount) {
        customer.completedLoanIds.add(row.loanId);
      }

      byCustomer.set(row.loans.customerId, customer);
    }

    const handleById = await this.mapUserIdsToHandles([...byCustomer.keys()]);

    return [...byCustomer.entries()]
      .map(([customerId, row]) => ({
        customerId: handleById.get(customerId) ?? String(customerId),
        repaymentCount: row.repaymentCount,
        amountCollected: row.amountCollected,
        completedLoanCount: row.completedLoanIds.size,
      }))
      .sort((left, right) => {
        if (right.completedLoanCount !== left.completedLoanCount) {
          return right.completedLoanCount - left.completedLoanCount;
        }
        if (right.repaymentCount !== left.repaymentCount) {
          return right.repaymentCount - left.repaymentCount;
        }
        return right.amountCollected - left.amountCollected;
      })
      .slice(0, topLimit);
  }

  private periodFilter(window: LoanPeriodWindow): Prisma.DateTimeFilter {
    return { gte: window.start, lt: window.endExclusive };
  }

  private async sumByLoanIdsBefore(
    loanIds: string[],
    before: Date,
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (loanIds.length === 0) {
      return map;
    }

    const groups = await this.prisma.repayment.groupBy({
      by: ['loanId'],
      where: {
        loanId: { in: loanIds },
        datePaid: { lt: before },
      },
      _sum: { amountPaid: true },
    });

    for (const group of groups) {
      map.set(group.loanId, group._sum.amountPaid ?? 0);
    }

    return map;
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

  private toResponse(
    row: Prisma.RepaymentGetPayload<{ select: typeof REPAYMENT_SELECT }>,
  ): RepaymentResponse {
    return {
      repaymentId: row.repaymentId,
      handlerId: row.users.userId,
      loanId: row.loans.publicId,
      amountPaid: row.amountPaid,
      datePaid: row.datePaid,
      handler: {
        userId: row.users.userId,
        fullname: row.users.fullname,
        email: row.users.email,
      },
    };
  }
}

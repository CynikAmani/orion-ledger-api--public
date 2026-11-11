import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentTransactionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { PLATFORM_PRODUCTION_TENANT_RELATION } from '../../tenants/shared/utils/platform-production-tenant.util';
import type { ListPlatformPaymentTransactionsQueryDto } from '../dto/list-platform-payment-transactions-query.dto';
import type { PaymentTransactionStatsQueryDto } from '../dto/payment-transaction-stats-query.dto';
import { formatPaymentAmount } from '../utils/payment-amount.util';
import {
  paginatedListMeta,
  type PaginatedListMeta,
} from '../utils/paginated-list.util';
import {
  paymentTransactionIntervalWindow,
  PAYMENT_TRANSACTION_INTERVALS,
  type PaymentTransactionInterval,
} from '../utils/payment-transaction-interval.util';
import {
  listSubscriptionPaymentEvents,
  type SubscriptionPaymentEventResponse,
} from '../utils/subscription-events.util';

export interface PaymentTransactionActor {
  id: number;
  userId: string;
  fullname: string;
  email: string | null;
}

export interface PlatformPaymentTransactionResponse {
  id: string;
  transactionReference: string;
  status: PaymentTransactionStatus;
  amount: string;
  currency: string;
  provider: string;
  providerTransactionId: string | null;
  failureReason: string | null;
  initiatedAt: string;
  completedAt: string | null;
  failedAt: string | null;
  uuid: string;
  tenantName: string;
  tenantCode: string;
  planId: number;
  planName: string | null;
  durationInDays: number;
  initiatedBy: PaymentTransactionActor | null;
  subscriptionId: string | null;
}

export interface PlatformPaymentTransactionDetailResponse extends PlatformPaymentTransactionResponse {
  events: SubscriptionPaymentEventResponse[];
}

export interface PaginatedPlatformPaymentTransactionsResponse {
  data: PlatformPaymentTransactionResponse[];
  meta: PaginatedListMeta;
}

export interface PaymentTransactionStatusTotals {
  PENDING: number;
  PROCESSING: number;
  SUCCESS: number;
  FAILED: number;
  CANCELLED: number;
  EXPIRED: number;
  total: number;
}

export interface PaymentTransactionAmountTotals {
  PENDING: string;
  PROCESSING: string;
  SUCCESS: string;
  FAILED: string;
  CANCELLED: string;
  EXPIRED: string;
  total: string;
}

export interface PaymentTransactionIntervalStats {
  interval: PaymentTransactionInterval;
  startsAt: string | null;
  endsAt: string;
  counts: PaymentTransactionStatusTotals;
  amounts: PaymentTransactionAmountTotals;
  distinctInitiators: number;
  distinctBrands: number;
}

export interface PaymentTransactionStatsResponse {
  generatedAt: string;
  intervals: PaymentTransactionIntervalStats[];
}

const PAYMENT_LIST_SELECT = {
  id: true,
  transactionReference: true,
  status: true,
  amount: true,
  currency: true,
  provider: true,
  providerTransactionId: true,
  failureReason: true,
  initiatedAt: true,
  completedAt: true,
  failedAt: true,
  durationInDays: true,
  planId: true,
  tenant: { select: { tenantId: true, name: true, tenantCode: true } },
  initiatedBy: {
    select: { id: true, userId: true, fullname: true, email: true },
  },
  subscription: { select: { id: true } },
} satisfies Prisma.PaymentTransactionSelect;

type PaymentListRow = Prisma.PaymentTransactionGetPayload<{
  select: typeof PAYMENT_LIST_SELECT;
}>;

@Injectable()
export class PlatformPaymentTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(
    query: PaymentTransactionStatsQueryDto,
  ): Promise<PaymentTransactionStatsResponse> {
    const now = new Date();
    const intervals = await Promise.all(
      PAYMENT_TRANSACTION_INTERVALS.map((interval) =>
        this.intervalStats(interval, now, query),
      ),
    );

    return { generatedAt: now.toISOString(), intervals };
  }

  async list(
    query: ListPlatformPaymentTransactionsQueryDto,
  ): Promise<PaginatedPlatformPaymentTransactionsResponse> {
    const where = this.listWhere(query, new Date());
    const [total, rows] = await Promise.all([
      this.prisma.paymentTransaction.count({ where }),
      this.prisma.paymentTransaction.findMany({
        where,
        orderBy: [{ initiatedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: PAYMENT_LIST_SELECT,
      }),
    ]);
    const planNames = await this.planNames(rows.map((row) => row.planId));

    return {
      data: rows.map((row) => toPaymentResponse(row, planNames)),
      meta: paginatedListMeta(query.page, query.limit, total),
    };
  }

  async get(id: string): Promise<PlatformPaymentTransactionDetailResponse> {
    const row = await this.prisma.paymentTransaction.findUnique({
      where: { id },
      select: PAYMENT_LIST_SELECT,
    });
    if (!row) {
      throw new NotFoundException('Payment transaction was not found');
    }

    const planNames = await this.planNames([row.planId]);
    const payment = toPaymentResponse(row, planNames);

    return {
      ...payment,
      events: await listSubscriptionPaymentEvents(this.prisma, {
        id: row.id,
        transactionReference: row.transactionReference,
        amount: payment.amount,
        currency: row.currency,
      }),
    };
  }

  private async intervalStats(
    interval: PaymentTransactionInterval,
    now: Date,
    query: PaymentTransactionStatsQueryDto,
  ): Promise<PaymentTransactionIntervalStats> {
    const window = paymentTransactionIntervalWindow(interval, now);
    const where = transactionWhere({
      uuid: query.uuid,
      initiatedById: query.initiatedById,
      initiatedFrom: window.startsAt,
      initiatedTo: window.endsAt,
      excludeDemoTenants: true,
    });
    const [grouped, initiators, brands] = await Promise.all([
      this.prisma.paymentTransaction.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.paymentTransaction.groupBy({
        by: ['initiatedById'],
        where: { ...where, initiatedById: { not: null } },
      }),
      this.prisma.paymentTransaction.groupBy({
        by: ['tenantId'],
        where,
      }),
    ]);

    const counts = emptyCounts();
    const amountValues = emptyAmounts();
    for (const row of grouped) {
      counts[row.status] = row._count._all;
      counts.total += row._count._all;
      amountValues[row.status] = row._sum.amount ?? new Prisma.Decimal(0);
      amountValues.total = amountValues.total.plus(amountValues[row.status]);
    }

    return {
      interval,
      startsAt: window.startsAt?.toISOString() ?? null,
      endsAt: window.endsAt.toISOString(),
      counts,
      amounts: {
        PENDING: formatPaymentAmount(amountValues.PENDING),
        PROCESSING: formatPaymentAmount(amountValues.PROCESSING),
        SUCCESS: formatPaymentAmount(amountValues.SUCCESS),
        FAILED: formatPaymentAmount(amountValues.FAILED),
        CANCELLED: formatPaymentAmount(amountValues.CANCELLED),
        EXPIRED: formatPaymentAmount(amountValues.EXPIRED),
        total: formatPaymentAmount(amountValues.total),
      },
      distinctInitiators: initiators.length,
      distinctBrands: brands.length,
    };
  }

  private listWhere(
    query: ListPlatformPaymentTransactionsQueryDto,
    now: Date,
  ): Prisma.PaymentTransactionWhereInput {
    const window = query.interval
      ? paymentTransactionIntervalWindow(query.interval, now)
      : null;

    // Operational list may include demo tenants; stats still exclude them.
    return transactionWhere({
      status: query.status,
      uuid: query.uuid,
      initiatedById: query.initiatedById,
      planId: query.planId,
      initiatedFrom: window?.startsAt ?? null,
      initiatedTo: window?.endsAt ?? null,
      excludeDemoTenants: false,
    });
  }

  private async planNames(planIds: number[]): Promise<Map<number, string>> {
    const ids = [...new Set(planIds)];
    if (ids.length === 0) {
      return new Map();
    }

    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    return new Map(plans.map((plan) => [plan.id, plan.name]));
  }
}

function transactionWhere(input: {
  status?: PaymentTransactionStatus;
  uuid?: string;
  initiatedById?: number;
  planId?: number;
  initiatedFrom: Date | null;
  initiatedTo: Date | null;
  excludeDemoTenants: boolean;
}): Prisma.PaymentTransactionWhereInput {
  return {
    ...(input.excludeDemoTenants ? PLATFORM_PRODUCTION_TENANT_RELATION : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.uuid ? { tenantId: input.uuid } : {}),
    ...(input.initiatedById ? { initiatedById: input.initiatedById } : {}),
    ...(input.planId ? { planId: input.planId } : {}),
    ...(input.initiatedFrom || input.initiatedTo
      ? {
          initiatedAt: {
            ...(input.initiatedFrom ? { gte: input.initiatedFrom } : {}),
            ...(input.initiatedTo ? { lte: input.initiatedTo } : {}),
          },
        }
      : {}),
  };
}

function toPaymentResponse(
  row: PaymentListRow,
  planNames: Map<number, string>,
): PlatformPaymentTransactionResponse {
  return {
    id: row.id,
    transactionReference: row.transactionReference,
    status: row.status,
    amount: formatPaymentAmount(row.amount),
    currency: row.currency,
    provider: row.provider,
    providerTransactionId: row.providerTransactionId,
    failureReason: row.failureReason,
    initiatedAt: row.initiatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
    uuid: row.tenant.tenantId,
    tenantName: row.tenant.name,
    tenantCode: row.tenant.tenantCode,
    planId: row.planId,
    planName: planNames.get(row.planId) ?? null,
    durationInDays: row.durationInDays,
    initiatedBy: row.initiatedBy,
    subscriptionId: row.subscription?.id ?? null,
  };
}

function emptyCounts(): PaymentTransactionStatusTotals {
  return {
    PENDING: 0,
    PROCESSING: 0,
    SUCCESS: 0,
    FAILED: 0,
    CANCELLED: 0,
    EXPIRED: 0,
    total: 0,
  };
}

function emptyAmounts(): Record<
  keyof PaymentTransactionAmountTotals,
  Prisma.Decimal
> {
  const zero = new Prisma.Decimal(0);
  return {
    PENDING: zero,
    PROCESSING: zero,
    SUCCESS: zero,
    FAILED: zero,
    CANCELLED: zero,
    EXPIRED: zero,
    total: zero,
  };
}

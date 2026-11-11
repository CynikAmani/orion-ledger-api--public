import { Injectable } from '@nestjs/common';
import { PaymentTransactionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  PLATFORM_PRODUCTION_TENANT_RELATION,
  PLATFORM_PRODUCTION_TENANT_SQL,
  PLATFORM_PRODUCTION_TENANT_WHERE,
} from '../../tenants/shared/utils/platform-production-tenant.util';
import type { ListSubscriptionSubscribersQueryDto } from '../dto/list-subscription-subscribers-query.dto';
import { formatPaymentAmount } from '../utils/payment-amount.util';
import {
  comparePlanPerformance,
  pickPlanPerformanceExtremes,
  type PlanPerformanceSnapshot,
} from '../utils/subscription-plan-performance.util';
import { SubscriptionPlansService } from './subscription-plans.service';

export interface SubscriptionPlanStatsResponse {
  activeSubscriberCount: number;
  transactionsInitiated: number;
}

export interface SubscriptionPlanPerformanceResponse {
  id: number;
  name: string;
  transactionsInitiated: number;
  successfulTransactions: number;
  activeSubscriberCount: number;
  revenue: string;
}

export interface SubscriptionCatalogStatsResponse {
  plans: {
    total: number;
    active: number;
    deactivated: number;
  };
  subscriptions: {
    total: number;
    activeNow: number;
    activeSubscribers: number;
  };
  transactions: {
    total: number;
    byStatus: Record<PaymentTransactionStatus, number>;
  };
  revenueCollected: string;
  mostPopularPlan: SubscriptionPlanPerformanceResponse | null;
  worstPerformingPlan: SubscriptionPlanPerformanceResponse | null;
  planPerformance: SubscriptionPlanPerformanceResponse[];
}

export interface SubscriptionSubscriberResponse {
  tenantId: string;
  tenantCode: string;
  slug: string;
  name: string;
  subscriptionId: string;
  planId: number | null;
  planName: string | null;
  billingCycle: string | null;
  startsAt: string;
  endsAt: string;
  amountPaid: string;
}

export interface PaginatedSubscriptionSubscribersResponse {
  items: SubscriptionSubscriberResponse[];
  page: number;
  limit: number;
  total: number;
}

type LatestSubscriptionRow = {
  subscription_id: string;
  tenant_id: string;
  plan_id: number | null;
  starts_at: Date;
  ends_at: Date;
  amount_paid: Prisma.Decimal | string | number;
};

@Injectable()
export class SubscriptionPlanStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: SubscriptionPlansService,
  ) {}

  async planStats(id: number): Promise<SubscriptionPlanStatsResponse> {
    await this.plans.findOne(id);
    const [activeSubscriberCount, transactionsInitiated] = await Promise.all([
      this.countActiveSubscribers(id),
      this.prisma.paymentTransaction.count({
        where: { planId: id, ...PLATFORM_PRODUCTION_TENANT_RELATION },
      }),
    ]);

    return { activeSubscriberCount, transactionsInitiated };
  }

  async catalogStats(): Promise<SubscriptionCatalogStatsResponse> {
    const now = new Date();
    const [
      planCount,
      activePlanCount,
      subscriptionCount,
      activeNow,
      activeSubscribers,
      transactionCount,
      transactionsByStatus,
      revenue,
      performance,
    ] = await Promise.all([
      this.prisma.subscriptionPlan.count(),
      this.prisma.subscriptionPlan.count({ where: { isActive: true } }),
      this.prisma.subscription.count({
        where: PLATFORM_PRODUCTION_TENANT_RELATION,
      }),
      this.prisma.subscription.count({
        where: {
          startsAt: { lte: now },
          endsAt: { gte: now },
          ...PLATFORM_PRODUCTION_TENANT_RELATION,
        },
      }),
      this.countActiveSubscribers(),
      this.prisma.paymentTransaction.count({
        where: PLATFORM_PRODUCTION_TENANT_RELATION,
      }),
      this.prisma.paymentTransaction.groupBy({
        by: ['status'],
        where: PLATFORM_PRODUCTION_TENANT_RELATION,
        _count: { _all: true },
      }),
      this.prisma.subscription.aggregate({
        where: PLATFORM_PRODUCTION_TENANT_RELATION,
        _sum: { amountPaid: true },
      }),
      this.loadPlanPerformance(),
    ]);

    const ranked = pickPlanPerformanceExtremes(performance);
    const deactivated = planCount - activePlanCount;

    return {
      plans: {
        total: planCount,
        active: activePlanCount,
        deactivated,
      },
      subscriptions: {
        total: subscriptionCount,
        activeNow,
        activeSubscribers,
      },
      transactions: {
        total: transactionCount,
        byStatus: emptyStatusCounts(transactionsByStatus),
      },
      revenueCollected: formatPaymentAmount(
        revenue._sum.amountPaid ?? new Prisma.Decimal(0),
      ),
      mostPopularPlan: toPerformanceResponse(ranked.mostPopular),
      worstPerformingPlan: toPerformanceResponse(ranked.worstPerforming),
      planPerformance: [...performance]
        .sort(comparePlanPerformance)
        .map((plan) => toPerformanceResponse(plan)!),
    };
  }

  async subscribers(
    query: ListSubscriptionSubscribersQueryDto,
  ): Promise<PaginatedSubscriptionSubscribersResponse> {
    if (query.planId !== undefined) {
      await this.plans.findOne(query.planId);
    }

    const now = new Date();
    const offset = (query.page - 1) * query.limit;
    const planFilter =
      query.planId === undefined
        ? Prisma.empty
        : Prisma.sql`AND latest.plan_id = ${query.planId}`;

    const [countRows, rows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM (
          SELECT DISTINCT ON (s.tenant_id) s.plan_id, s.ends_at
          FROM subscriptions s
          INNER JOIN tenants t ON t.tenant_id = s.tenant_id
          WHERE ${PLATFORM_PRODUCTION_TENANT_SQL}
          ORDER BY s.tenant_id, s.ends_at DESC, s.created_at DESC
        ) latest
        WHERE latest.ends_at >= ${now}
        ${planFilter}
      `),
      this.prisma.$queryRaw<LatestSubscriptionRow[]>(Prisma.sql`
        SELECT
          latest.subscription_id,
          latest.tenant_id,
          latest.plan_id,
          latest.starts_at,
          latest.ends_at,
          latest.amount_paid
        FROM (
          SELECT DISTINCT ON (s.tenant_id)
            s.subscription_id,
            s.tenant_id,
            s.plan_id,
            s.starts_at,
            s.ends_at,
            s.amount_paid
          FROM subscriptions s
          INNER JOIN tenants t ON t.tenant_id = s.tenant_id
          WHERE ${PLATFORM_PRODUCTION_TENANT_SQL}
          ORDER BY s.tenant_id, s.ends_at DESC, s.created_at DESC
        ) latest
        WHERE latest.ends_at >= ${now}
        ${planFilter}
        ORDER BY latest.ends_at ASC, latest.tenant_id ASC
        LIMIT ${query.limit} OFFSET ${offset}
      `),
    ]);

    const tenantIds = rows.map((row) => row.tenant_id);
    const planIds = rows
      .map((row) => row.plan_id)
      .filter((planId): planId is number => planId !== null);

    const [tenants, plans] = await Promise.all([
      this.prisma.tenant.findMany({
        where: {
          tenantId: { in: tenantIds },
          ...PLATFORM_PRODUCTION_TENANT_WHERE,
        },
        select: {
          tenantId: true,
          tenantCode: true,
          slug: true,
          name: true,
        },
      }),
      this.prisma.subscriptionPlan.findMany({
        where: { id: { in: planIds } },
        select: { id: true, name: true, billingCycle: true },
      }),
    ]);

    const tenantsById = new Map(
      tenants.map((tenant) => [tenant.tenantId, tenant]),
    );
    const plansById = new Map(plans.map((plan) => [plan.id, plan]));

    return {
      page: query.page,
      limit: query.limit,
      total: countRows[0]?.total ?? 0,
      items: rows.flatMap((row) => {
        const tenant = tenantsById.get(row.tenant_id);
        if (!tenant) {
          return [];
        }

        const plan = row.plan_id === null ? null : plansById.get(row.plan_id);
        return [
          {
            tenantId: tenant.tenantId,
            tenantCode: tenant.tenantCode,
            slug: tenant.slug,
            name: tenant.name,
            subscriptionId: row.subscription_id,
            planId: row.plan_id,
            planName: plan?.name ?? null,
            billingCycle: plan?.billingCycle ?? null,
            startsAt: new Date(row.starts_at).toISOString(),
            endsAt: new Date(row.ends_at).toISOString(),
            amountPaid: formatPaymentAmount(
              new Prisma.Decimal(row.amount_paid),
            ),
          },
        ];
      }),
    };
  }

  private async countActiveSubscribers(planId?: number): Promise<number> {
    const now = new Date();
    const planFilter =
      planId === undefined
        ? Prisma.empty
        : Prisma.sql`AND latest.plan_id = ${planId}`;
    const rows = await this.prisma.$queryRaw<
      Array<{ total: number }>
    >(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM (
        SELECT DISTINCT ON (s.tenant_id) s.plan_id, s.ends_at
        FROM subscriptions s
        INNER JOIN tenants t ON t.tenant_id = s.tenant_id
        WHERE ${PLATFORM_PRODUCTION_TENANT_SQL}
        ORDER BY s.tenant_id, s.ends_at DESC, s.created_at DESC
      ) latest
      WHERE latest.ends_at >= ${now}
      ${planFilter}
    `);

    return rows[0]?.total ?? 0;
  }

  private async loadPlanPerformance(): Promise<PlanPerformanceSnapshot[]> {
    const [plans, transactions, successful, subscribers, revenue] =
      await Promise.all([
        this.prisma.subscriptionPlan.findMany({
          select: { id: true, name: true },
        }),
        this.prisma.paymentTransaction.groupBy({
          by: ['planId'],
          where: PLATFORM_PRODUCTION_TENANT_RELATION,
          _count: { _all: true },
        }),
        this.prisma.paymentTransaction.groupBy({
          by: ['planId'],
          where: {
            status: PaymentTransactionStatus.SUCCESS,
            ...PLATFORM_PRODUCTION_TENANT_RELATION,
          },
          _count: { _all: true },
        }),
        this.activeSubscribersByPlan(),
        this.prisma.subscription.groupBy({
          by: ['planId'],
          where: {
            planId: { not: null },
            ...PLATFORM_PRODUCTION_TENANT_RELATION,
          },
          _sum: { amountPaid: true },
        }),
      ]);

    const transactionsByPlan = new Map(
      transactions.map((row) => [row.planId, row._count._all] as const),
    );
    const successfulByPlan = new Map(
      successful.map((row) => [row.planId, row._count._all] as const),
    );
    const revenueByPlan = new Map<number, number>();
    for (const row of revenue) {
      if (row.planId !== null) {
        revenueByPlan.set(row.planId, Number(row._sum.amountPaid ?? 0));
      }
    }

    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      transactionsInitiated: transactionsByPlan.get(plan.id) ?? 0,
      successfulTransactions: successfulByPlan.get(plan.id) ?? 0,
      activeSubscriberCount: subscribers.get(plan.id) ?? 0,
      revenue: revenueByPlan.get(plan.id) ?? 0,
    }));
  }

  private async activeSubscribersByPlan(): Promise<Map<number, number>> {
    const now = new Date();
    const rows = await this.prisma.$queryRaw<
      Array<{ plan_id: number; total: number }>
    >(Prisma.sql`
      SELECT latest.plan_id, COUNT(*)::int AS total
      FROM (
        SELECT DISTINCT ON (s.tenant_id) s.plan_id, s.ends_at
        FROM subscriptions s
        INNER JOIN tenants t ON t.tenant_id = s.tenant_id
        WHERE ${PLATFORM_PRODUCTION_TENANT_SQL}
        ORDER BY s.tenant_id, s.ends_at DESC, s.created_at DESC
      ) latest
      WHERE latest.ends_at >= ${now}
        AND latest.plan_id IS NOT NULL
      GROUP BY latest.plan_id
    `);

    return new Map(rows.map((row) => [row.plan_id, row.total]));
  }
}

function emptyStatusCounts(
  rows: Array<{ status: PaymentTransactionStatus; _count: { _all: number } }>,
): Record<PaymentTransactionStatus, number> {
  const counts = Object.values(PaymentTransactionStatus).reduce(
    (accumulator, status) => {
      accumulator[status] = 0;
      return accumulator;
    },
    {} as Record<PaymentTransactionStatus, number>,
  );

  for (const row of rows) {
    counts[row.status] = row._count._all;
  }

  return counts;
}

function toPerformanceResponse(
  plan: PlanPerformanceSnapshot | null,
): SubscriptionPlanPerformanceResponse | null {
  if (!plan) {
    return null;
  }

  return {
    id: plan.id,
    name: plan.name,
    transactionsInitiated: plan.transactionsInitiated,
    successfulTransactions: plan.successfulTransactions,
    activeSubscriberCount: plan.activeSubscriberCount,
    revenue: new Prisma.Decimal(plan.revenue).toDecimalPlaces(2).toFixed(2),
  };
}

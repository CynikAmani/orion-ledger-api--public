import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type SubscriptionBillingCycle } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  BrandAboutService,
  type PlatformContactDetails,
} from '../../system-configurations/platform/brand-about/services/brand-about.service';
import { formatPaymentAmount } from '../utils/payment-amount.util';
import {
  paginatedListMeta,
  type PaginatedListMeta,
} from '../utils/paginated-list.util';
import {
  resolveTenantSubscriptionAccess,
  subscriptionTimelinePhase,
  type SubscriptionTimelinePhase,
  type TenantAccessState,
} from '../utils/subscription-access.util';
import {
  listSubscriptionPaymentEvents,
  type SubscriptionEventActor,
  type SubscriptionPaymentEventResponse,
} from '../utils/subscription-events.util';

export interface TenantSubscriptionPlanSummary {
  id: number;
  name: string;
  billingCycle: SubscriptionBillingCycle;
  durationInDays: number;
}

export interface TenantCurrentPlanResponse extends TenantSubscriptionPlanSummary {
  price: string;
  isActive: boolean;
}

export interface TenantSubscriptionAccessResponse {
  accessState: TenantAccessState;
  onTrial: boolean;
  /** Raw Tenant.trialEndsAt (null when open-ended or not on a dated trial). */
  trialEndsAt: string | null;
  daysRemaining: number | null;
  accessStartsAt: string | null;
  accessEndsAt: string | null;
  plan: TenantSubscriptionPlanSummary | null;
  currentPlan: TenantCurrentPlanResponse | null;
  /**
   * Orion platform contact channels (About row). For manual-payment UX when
   * online checkout is disabled. Not tenant brand contacts.
   */
  platformContact: PlatformContactDetails;
}

export interface TenantSubscriptionHistoryItemResponse {
  id: string;
  type: 'TRIAL' | 'PAID';
  phase: SubscriptionTimelinePhase;
  planId: number | null;
  planName: string | null;
  billingCycle: SubscriptionBillingCycle | null;
  amountPaid: string;
  paymentMethod: 'ONLINE' | 'ELECTRONIC_FUNDS_TRANSFER' | 'MANUAL_CASH' | null;
  startsAt: string;
  endsAt: string;
  paymentTransactionId: string | null;
  issuedBy: SubscriptionEventActor | null;
  createdAt: string;
}

export interface TenantSubscriptionDetailResponse extends TenantSubscriptionHistoryItemResponse {
  notes: string | null;
  payment: {
    id: string;
    transactionReference: string;
    status: string;
    currency: string;
    amount: string;
    initiatedAt: string;
    completedAt: string | null;
    failedAt: string | null;
    failureReason: string | null;
  } | null;
  events: SubscriptionPaymentEventResponse[];
}

export interface PaginatedTenantSubscriptionHistoryResponse {
  data: TenantSubscriptionHistoryItemResponse[];
  meta: PaginatedListMeta;
}

@Injectable()
export class TenantSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brandAbout: BrandAboutService,
  ) {}

  async access(tenantId: string): Promise<TenantSubscriptionAccessResponse> {
    const now = new Date();
    const [tenant, platformContact, open] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { tenantId },
        select: {
          subscriptionStatus: true,
          trialEndsAt: true,
          currentPlan: {
            select: {
              id: true,
              name: true,
              billingCycle: true,
              durationInDays: true,
              price: true,
              isActive: true,
            },
          },
        },
      }),
      this.brandAbout.getPlatformContact(),
      this.prisma.subscription.findMany({
        where: { tenantId, endsAt: { gt: now } },
        orderBy: { startsAt: 'asc' },
        select: {
          startsAt: true,
          endsAt: true,
          plan: {
            select: {
              id: true,
              name: true,
              billingCycle: true,
              durationInDays: true,
            },
          },
        },
      }),
    ]);

    if (!tenant) {
      throw new NotFoundException('Institution was not found');
    }

    const access = resolveTenantSubscriptionAccess({
      now,
      subscriptionStatus: tenant.subscriptionStatus,
      trialEndsAt: tenant.trialEndsAt,
      openWindows: open,
    });
    const covering = open.filter(
      (window) => window.startsAt <= now && window.endsAt > now,
    );
    const current = covering.reduce<(typeof open)[number] | null>(
      (latest, window) =>
        !latest || window.startsAt >= latest.startsAt ? window : latest,
      null,
    );

    return {
      accessState: access.accessState,
      onTrial: access.onTrial,
      trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
      daysRemaining: access.daysRemaining,
      accessStartsAt: access.accessStartsAt?.toISOString() ?? null,
      accessEndsAt: access.accessEndsAt?.toISOString() ?? null,
      plan: current?.plan ?? null,
      currentPlan: tenant.currentPlan
        ? {
            id: tenant.currentPlan.id,
            name: tenant.currentPlan.name,
            billingCycle: tenant.currentPlan.billingCycle,
            durationInDays: tenant.currentPlan.durationInDays,
            price: formatPaymentAmount(tenant.currentPlan.price),
            isActive: tenant.currentPlan.isActive,
          }
        : null,
      platformContact,
    };
  }

  async history(
    tenantId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedTenantSubscriptionHistoryResponse> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { tenantId },
      select: { tenantId: true },
    });

    if (!tenant) {
      throw new NotFoundException('Institution was not found');
    }

    const now = new Date();
    const where = { tenantId };
    const [total, rows] = await Promise.all([
      this.prisma.subscription.count({ where }),
      this.prisma.subscription.findMany({
        where,
        orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          amountPaid: true,
          paymentMethod: true,
          startsAt: true,
          endsAt: true,
          paymentTransactionId: true,
          recordedById: true,
          createdAt: true,
          plan: {
            select: { id: true, name: true, billingCycle: true },
          },
          paymentTransaction: {
            select: {
              initiatedBy: {
                select: { id: true, fullname: true, email: true },
              },
            },
          },
        },
      }),
    ]);
    const actors = await this.loadActors(rows.map((row) => row.recordedById));

    return {
      data: rows.map((row) => toTenantHistoryItem(now, row, actors)),
      meta: paginatedListMeta(page, limit, total),
    };
  }

  async get(
    tenantId: string,
    id: string,
  ): Promise<TenantSubscriptionDetailResponse> {
    const now = new Date();
    const row = await this.prisma.subscription.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        type: true,
        amountPaid: true,
        paymentMethod: true,
        startsAt: true,
        endsAt: true,
        notes: true,
        paymentTransactionId: true,
        recordedById: true,
        createdAt: true,
        plan: {
          select: { id: true, name: true, billingCycle: true },
        },
        paymentTransaction: {
          select: {
            id: true,
            transactionReference: true,
            status: true,
            currency: true,
            amount: true,
            initiatedAt: true,
            completedAt: true,
            failedAt: true,
            failureReason: true,
            initiatedBy: {
              select: { id: true, fullname: true, email: true },
            },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('Subscription was not found');
    }

    const actors = await this.loadActors([row.recordedById]);
    const payment = row.paymentTransaction;

    return {
      ...toTenantHistoryItem(now, row, actors),
      notes: row.notes,
      payment: payment
        ? {
            id: payment.id,
            transactionReference: payment.transactionReference,
            status: payment.status,
            currency: payment.currency,
            amount: formatPaymentAmount(payment.amount),
            initiatedAt: payment.initiatedAt.toISOString(),
            completedAt: payment.completedAt?.toISOString() ?? null,
            failedAt: payment.failedAt?.toISOString() ?? null,
            failureReason: payment.failureReason,
          }
        : null,
      events: await listSubscriptionPaymentEvents(
        this.prisma,
        payment
          ? {
              id: payment.id,
              transactionReference: payment.transactionReference,
              amount: formatPaymentAmount(payment.amount),
              currency: payment.currency,
            }
          : null,
      ),
    };
  }

  private async loadActors(recordedByIds: Array<string | null>) {
    const ids = [
      ...new Set(
        recordedByIds
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    ];
    if (ids.length === 0) {
      return new Map<number, SubscriptionEventActor>();
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullname: true, email: true },
    });
    return new Map(users.map((user) => [user.id, user]));
  }
}

function toTenantHistoryItem(
  now: Date,
  row: {
    id: string;
    type: 'TRIAL' | 'PAID';
    amountPaid: Prisma.Decimal;
    paymentMethod: TenantSubscriptionHistoryItemResponse['paymentMethod'];
    startsAt: Date;
    endsAt: Date;
    paymentTransactionId: string | null;
    recordedById: string | null;
    createdAt: Date;
    plan: {
      id: number;
      name: string;
      billingCycle: SubscriptionBillingCycle;
    } | null;
    paymentTransaction: {
      initiatedBy: SubscriptionEventActor | null;
    } | null;
  },
  actors: Map<number, SubscriptionEventActor>,
): TenantSubscriptionHistoryItemResponse {
  const recordedById = Number(row.recordedById);
  const recordedBy = Number.isInteger(recordedById)
    ? (actors.get(recordedById) ?? null)
    : null;

  return {
    id: row.id,
    type: row.type,
    phase: subscriptionTimelinePhase(now, row.startsAt, row.endsAt),
    planId: row.plan?.id ?? null,
    planName: row.plan?.name ?? null,
    billingCycle: row.plan?.billingCycle ?? null,
    amountPaid: formatPaymentAmount(row.amountPaid),
    paymentMethod: row.paymentMethod,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    paymentTransactionId: row.paymentTransactionId,
    issuedBy: row.paymentTransaction?.initiatedBy ?? recordedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

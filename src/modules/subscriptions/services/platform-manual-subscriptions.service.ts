import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
  SubscriptionType,
} from '@prisma/client';
import type { AuditContext } from '../../../core/audit/interfaces/audit-payload.interface';
import { formatDisplayDate } from '../../../common/utils/format-date.util';
import { AuditEmitterService } from '../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { PLATFORM_NOTIFICATION_ACTIONS } from '../../../core/notifications/constants/notification-action-keys.constant';
import { NotificationDispatcherService } from '../../../core/notifications/services/notification-dispatcher.service';
import { SUBSCRIPTION_PAYMENT_AUDIT_ACTIONS } from '../constants/subscription-payment-audit-actions.constant';
import { MANUAL_SUBSCRIPTION_PAYMENT_METHODS } from '../constants/manual-subscription-payment-methods.constant';
import type { ListManualSubscriptionsQueryDto } from '../dto/list-manual-subscriptions-query.dto';
import type { RecordManualSubscriptionDto } from '../dto/record-manual-subscription.dto';
import { resolveTenantBrandName } from '../../tenants/shared/utils/resolve-tenant-brand-name.util';
import { formatPaymentAmount } from '../utils/payment-amount.util';
import {
  paginatedListMeta,
  type PaginatedListMeta,
} from '../utils/paginated-list.util';
import { subscriptionTimelinePhase } from '../utils/subscription-access.util';
import {
  addDurationInDays,
  canRemovePlatformSubscription,
  nextScheduledStart,
  subscriptionWindowsOverlap,
  timestampToSeconds,
} from '../utils/subscription-coverage.util';
import {
  listSubscriptionPaymentEvents,
  type SubscriptionPaymentEventResponse,
} from '../utils/subscription-events.util';
import {
  calculateDiscountedPrice,
  findPublicPlanDiscount,
} from '../utils/subscription-plan-discount.util';
import {
  SubscriptionPlansService,
  type SubscriptionPlanResponse,
} from './subscription-plans.service';

export interface ManualSubscriptionPreviewResponse {
  uuid: string;
  tenantName: string;
  planId: number;
  planName: string;
  billingCycle: string;
  durationInDays: number;
  price: string;
  amount: string;
  startsAt: string;
  endsAt: string;
  stacksAfterOpenSubscription: boolean;
}

export interface RecordedSubscriptionActor {
  id: number;
  fullname: string;
  email: string | null;
}

export interface ManualSubscriptionResponse extends ManualSubscriptionPreviewResponse {
  id: string;
  paymentMethod: (typeof MANUAL_SUBSCRIPTION_PAYMENT_METHODS)[number];
  notes: string | null;
  recordedBy: RecordedSubscriptionActor | null;
  createdAt: string;
}

export interface ManualSubscriptionHistoryItemResponse {
  id: string;
  uuid: string;
  tenantName: string;
  planId: number | null;
  planName: string | null;
  billingCycle: string | null;
  durationInDays: number | null;
  price: string | null;
  amount: string;
  paymentMethod: (typeof MANUAL_SUBSCRIPTION_PAYMENT_METHODS)[number];
  phase: 'upcoming' | 'active' | 'past';
  removable: boolean;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  recordedBy: RecordedSubscriptionActor | null;
  createdAt: string;
}

export interface SubscriptionPaymentSummary {
  id: string;
  transactionReference: string;
  status: string;
  currency: string;
  amount: string;
  initiatedAt: string;
  completedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
}

export interface ManualSubscriptionDetailResponse extends ManualSubscriptionHistoryItemResponse {
  payment: SubscriptionPaymentSummary | null;
  events: SubscriptionPaymentEventResponse[];
}

export interface PaginatedManualSubscriptionsResponse {
  data: ManualSubscriptionHistoryItemResponse[];
  meta: PaginatedListMeta;
}

@Injectable()
export class PlatformManualSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: SubscriptionPlansService,
    private readonly auditEmitter: AuditEmitterService,
    private readonly notificationDispatcher: NotificationDispatcherService,
  ) {}

  private async resolveOrganization(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { tenantId },
      select: {
        name: true,
        brandProfile: { select: { brandName: true } },
      },
    });

    return resolveTenantBrandName({
      tenantName: tenant?.name,
      brandName: tenant?.brandProfile?.brandName,
    });
  }

  listActivePlans(): Promise<SubscriptionPlanResponse[]> {
    return this.plans.listActiveCatalog();
  }

  async preview(
    uuid: string,
    planId: number,
  ): Promise<ManualSubscriptionPreviewResponse> {
    const quote = await this.quote(uuid, planId, new Date());
    return quote.preview;
  }

  async record(
    dto: RecordManualSubscriptionDto,
    recordedById: number,
    audit: AuditContext,
  ): Promise<ManualSubscriptionResponse> {
    const now = new Date();
    const notes = normalizeNotes(dto.notes);

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT tenant_id FROM tenants WHERE tenant_id = ${dto.uuid} FOR UPDATE`,
      );
      const quote = await this.quote(dto.uuid, dto.planId, now, tx);
      const subscription = await tx.subscription.create({
        data: {
          tenantId: dto.uuid,
          planId: quote.plan.id,
          type: SubscriptionType.PAID,
          amountPaid: quote.amount,
          paymentMethod: dto.paymentMethod,
          startsAt: quote.startsAt,
          endsAt: quote.endsAt,
          recordedById: String(recordedById),
          notes,
        },
        select: { id: true, createdAt: true },
      });

      await tx.tenant.update({
        where: { tenantId: dto.uuid },
        data: {
          subscriptionStatus: SubscriptionStatus.PAID,
          paymentStatus: PaymentStatus.PAID,
          currentPlanId: quote.plan.id,
          subscriptionAccessEndsAt: quote.endsAt,
        },
      });

      return { subscription, quote };
    });

    this.auditEmitter.emit({
      ...audit,
      tenantId: dto.uuid,
      module: 'SUBSCRIPTIONS',
      action: SUBSCRIPTION_PAYMENT_AUDIT_ACTIONS.MANUAL_RECORDED,
      targetType: 'Subscription',
      targetId: created.subscription.id,
      payload: {
        planId: created.quote.plan.id,
        planName: created.quote.plan.name,
        amount: formatPaymentAmount(created.quote.amount),
        paymentMethod: dto.paymentMethod,
        startsAt: created.quote.startsAt.toISOString(),
        endsAt: created.quote.endsAt.toISOString(),
        recordedById,
      },
    });

    const organization = await this.resolveOrganization(dto.uuid);
    const amountLabel = formatPaymentAmount(created.quote.amount);

    void this.notificationDispatcher.dispatch(
      PLATFORM_NOTIFICATION_ACTIONS.SUBSCRIPTIONS.CREATED,
      {
        subject: 'Tenant subscription created',
        message: `Subscription recorded for ${organization} (${created.quote.plan.name}, ${amountLabel}).`,
        templateData: {
          organization,
          tenantId: dto.uuid,
          subscriptionId: created.subscription.id,
          planId: created.quote.plan.id,
          planName: created.quote.plan.name,
          amount: amountLabel,
          paymentMethod: dto.paymentMethod,
          startsAt: formatDisplayDate(created.quote.startsAt),
          endsAt: formatDisplayDate(created.quote.endsAt),
        },
      },
    );

    const actor = await this.prisma.user.findUnique({
      where: { id: recordedById },
      select: { id: true, fullname: true, email: true },
    });

    return {
      ...created.quote.preview,
      id: created.subscription.id,
      paymentMethod: dto.paymentMethod,
      notes,
      recordedBy: actor,
      createdAt: created.subscription.createdAt.toISOString(),
    };
  }

  async history(
    query: ListManualSubscriptionsQueryDto,
  ): Promise<PaginatedManualSubscriptionsResponse> {
    const now = new Date();
    const where: Prisma.SubscriptionWhereInput = {
      paymentMethod: query.paymentMethod ?? {
        in: [...MANUAL_SUBSCRIPTION_PAYMENT_METHODS],
      },
      ...(query.uuid ? { tenantId: query.uuid } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.subscription.count({ where }),
      this.prisma.subscription.findMany({
        where,
        orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: MANUAL_HISTORY_SELECT,
      }),
    ]);

    const actors = await this.loadActors(rows.map((row) => row.recordedById));

    return {
      data: rows.flatMap((row) => {
        const item = toManualHistoryItem(now, row, actors);
        return item ? [item] : [];
      }),
      meta: paginatedListMeta(query.page, query.limit, total),
    };
  }

  async get(id: string): Promise<ManualSubscriptionDetailResponse> {
    const now = new Date();
    const row = await this.prisma.subscription.findUnique({
      where: { id },
      select: {
        ...MANUAL_HISTORY_SELECT,
        paymentTransactionId: true,
        paymentTransaction: { select: PAYMENT_SUMMARY_SELECT },
      },
    });
    const actors = await this.loadActors([row?.recordedById ?? null]);
    const item = row ? toManualHistoryItem(now, row, actors) : null;
    if (!row || !item) {
      throw new NotFoundException('Subscription was not found');
    }

    const payment = toPaymentSummary(row.paymentTransaction);
    return {
      ...item,
      payment,
      events: await listSubscriptionPaymentEvents(this.prisma, payment),
    };
  }

  async remove(
    id: string,
    audit: AuditContext,
  ): Promise<{ id: string; removed: true }> {
    const now = new Date();
    const existing = await this.prisma.subscription.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        planId: true,
        paymentMethod: true,
        amountPaid: true,
        startsAt: true,
        endsAt: true,
        notes: true,
        recordedById: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('Subscription was not found');
    }
    assertRemovable(now, existing);

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT tenant_id FROM tenants WHERE tenant_id = ${existing.tenantId} FOR UPDATE`,
      );
      const current = await tx.subscription.findUnique({
        where: { id },
        select: {
          id: true,
          tenantId: true,
          paymentMethod: true,
          startsAt: true,
        },
      });
      if (!current) {
        throw new NotFoundException('Subscription was not found');
      }
      assertRemovable(now, current);
      await tx.subscription.delete({ where: { id } });
      await refreshTenantCoverage(tx, current.tenantId, now);
    });

    this.auditEmitter.emit({
      ...audit,
      tenantId: existing.tenantId,
      module: 'SUBSCRIPTIONS',
      action: SUBSCRIPTION_PAYMENT_AUDIT_ACTIONS.MANUAL_REMOVED,
      targetType: 'Subscription',
      targetId: existing.id,
      payload: {
        planId: existing.planId,
        amount: formatPaymentAmount(existing.amountPaid),
        paymentMethod: existing.paymentMethod,
        startsAt: existing.startsAt.toISOString(),
        endsAt: existing.endsAt.toISOString(),
        notes: existing.notes,
        recordedById: existing.recordedById,
      },
    });

    return { id: existing.id, removed: true };
  }

  private async quote(
    uuid: string,
    planId: number,
    now: Date,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<{
    preview: ManualSubscriptionPreviewResponse;
    plan: { id: number; name: string };
    amount: Prisma.Decimal;
    startsAt: Date;
    endsAt: Date;
  }> {
    const tenant = await db.tenant.findUnique({
      where: { tenantId: uuid },
      select: { tenantId: true, name: true, isActive: true, deletedAt: true },
    });
    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Institution was not found');
    }
    if (!tenant.isActive) {
      throw new BadRequestException('This institution is not active');
    }

    const plan = await db.subscriptionPlan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        name: true,
        billingCycle: true,
        durationInDays: true,
        price: true,
        isActive: true,
        discounts: {
          select: {
            id: true,
            code: true,
            discountType: true,
            value: true,
            startsAt: true,
            endsAt: true,
            isActive: true,
          },
        },
      },
    });
    if (!plan) {
      throw new NotFoundException('Subscription plan was not found');
    }
    if (!plan.isActive || plan.durationInDays < 1) {
      throw new BadRequestException('This plan is not available');
    }

    const amount = calculateDiscountedPrice(
      plan.price,
      findPublicPlanDiscount(now, plan.discounts),
    );
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('This plan is not available');
    }

    const openWindows = await db.subscription.findMany({
      where: { tenantId: uuid, endsAt: { gt: now } },
      select: { startsAt: true, endsAt: true },
    });
    const startsAt = nextScheduledStart(now, openWindows);
    const endsAt = addDurationInDays(startsAt, plan.durationInDays);
    if (
      openWindows.some((existing) =>
        subscriptionWindowsOverlap(existing, { startsAt, endsAt }),
      )
    ) {
      throw new ConflictException('This period already has a subscription');
    }

    return {
      plan,
      amount,
      startsAt,
      endsAt,
      preview: {
        uuid: tenant.tenantId,
        tenantName: tenant.name,
        planId: plan.id,
        planName: plan.name,
        billingCycle: plan.billingCycle,
        durationInDays: plan.durationInDays,
        price: formatPaymentAmount(plan.price),
        amount: formatPaymentAmount(amount),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        stacksAfterOpenSubscription: startsAt > timestampToSeconds(now),
      },
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
      return new Map<number, RecordedSubscriptionActor>();
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullname: true, email: true },
    });
    return new Map(users.map((user) => [user.id, user]));
  }
}

function actorFrom(
  recordedById: string | null,
  actors: Map<number, RecordedSubscriptionActor>,
): RecordedSubscriptionActor | null {
  const id = Number(recordedById);
  if (!Number.isInteger(id)) {
    return null;
  }
  return actors.get(id) ?? null;
}

function normalizeNotes(notes: string | undefined): string | null {
  const trimmed = notes?.trim() ?? '';
  return trimmed.length === 0 ? null : trimmed;
}

const MANUAL_HISTORY_SELECT = {
  id: true,
  tenantId: true,
  amountPaid: true,
  paymentMethod: true,
  startsAt: true,
  endsAt: true,
  notes: true,
  recordedById: true,
  createdAt: true,
  plan: {
    select: {
      id: true,
      name: true,
      billingCycle: true,
      durationInDays: true,
      price: true,
    },
  },
  tenant: { select: { name: true } },
} satisfies Prisma.SubscriptionSelect;

type ManualHistoryRow = Prisma.SubscriptionGetPayload<{
  select: typeof MANUAL_HISTORY_SELECT;
}>;

const PAYMENT_SUMMARY_SELECT = {
  id: true,
  transactionReference: true,
  status: true,
  currency: true,
  amount: true,
  initiatedAt: true,
  completedAt: true,
  failedAt: true,
  failureReason: true,
} satisfies Prisma.PaymentTransactionSelect;

function toManualHistoryItem(
  now: Date,
  row: ManualHistoryRow,
  actors: Map<number, RecordedSubscriptionActor>,
): ManualSubscriptionHistoryItemResponse | null {
  if (
    row.paymentMethod !== 'MANUAL_CASH' &&
    row.paymentMethod !== 'ELECTRONIC_FUNDS_TRANSFER'
  ) {
    return null;
  }

  return {
    id: row.id,
    uuid: row.tenantId,
    tenantName: row.tenant.name,
    planId: row.plan?.id ?? null,
    planName: row.plan?.name ?? null,
    billingCycle: row.plan?.billingCycle ?? null,
    durationInDays: row.plan?.durationInDays ?? null,
    price: row.plan ? formatPaymentAmount(row.plan.price) : null,
    amount: formatPaymentAmount(row.amountPaid),
    paymentMethod: row.paymentMethod,
    phase: subscriptionTimelinePhase(now, row.startsAt, row.endsAt),
    removable: canRemovePlatformSubscription({
      now,
      startsAt: row.startsAt,
      paymentMethod: row.paymentMethod,
    }),
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    notes: row.notes,
    recordedBy: actorFrom(row.recordedById, actors),
    createdAt: row.createdAt.toISOString(),
  };
}

function toPaymentSummary(
  payment: Prisma.PaymentTransactionGetPayload<{
    select: typeof PAYMENT_SUMMARY_SELECT;
  }> | null,
): SubscriptionPaymentSummary | null {
  if (!payment) {
    return null;
  }

  return {
    id: payment.id,
    transactionReference: payment.transactionReference,
    status: payment.status,
    currency: payment.currency,
    amount: formatPaymentAmount(payment.amount),
    initiatedAt: payment.initiatedAt.toISOString(),
    completedAt: payment.completedAt?.toISOString() ?? null,
    failedAt: payment.failedAt?.toISOString() ?? null,
    failureReason: payment.failureReason,
  };
}

function assertRemovable(
  now: Date,
  subscription: { paymentMethod: string | null; startsAt: Date },
): void {
  if (
    subscription.paymentMethod !== 'MANUAL_CASH' &&
    subscription.paymentMethod !== 'ELECTRONIC_FUNDS_TRANSFER'
  ) {
    throw new ConflictException(
      'Only a Cash or EFT subscription can be removed',
    );
  }

  if (
    !canRemovePlatformSubscription({
      now,
      startsAt: subscription.startsAt,
      paymentMethod: subscription.paymentMethod,
    })
  ) {
    throw new ConflictException(
      'An active or past subscription cannot be removed',
    );
  }
}

async function refreshTenantCoverage(
  tx: Prisma.TransactionClient,
  tenantId: string,
  now: Date,
): Promise<void> {
  const latestOpen = await tx.subscription.findFirst({
    where: { tenantId, endsAt: { gt: now } },
    orderBy: { endsAt: 'desc' },
    select: { planId: true, endsAt: true },
  });
  if (latestOpen) {
    await tx.tenant.update({
      where: { tenantId },
      data: {
        currentPlanId: latestOpen.planId,
        subscriptionStatus: SubscriptionStatus.PAID,
        paymentStatus: PaymentStatus.PAID,
        subscriptionAccessEndsAt: latestOpen.endsAt,
      },
    });
    return;
  }

  const latest = await tx.subscription.findFirst({
    where: { tenantId },
    orderBy: { endsAt: 'desc' },
    select: { planId: true },
  });
  const tenant = await tx.tenant.findUnique({
    where: { tenantId },
    select: { trialEndsAt: true },
  });
  const trialOpen = tenant?.trialEndsAt == null || tenant.trialEndsAt > now;
  await tx.tenant.update({
    where: { tenantId },
    data: {
      currentPlanId: latest?.planId ?? null,
      subscriptionAccessEndsAt: null,
      subscriptionStatus: latest
        ? SubscriptionStatus.EXPIRED
        : trialOpen
          ? SubscriptionStatus.TRIAL
          : SubscriptionStatus.EXPIRED,
      paymentStatus: latest ? PaymentStatus.PAID : PaymentStatus.PENDING,
    },
  });
}

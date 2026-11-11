import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiscountType, Prisma, SubscriptionBillingCycle } from '@prisma/client';
import type { AuditContext } from '../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { DEFAULT_SUBSCRIPTION_PLANS } from '../constants/default-subscription-plans.constant';
import { SUBSCRIPTION_PLAN_AUDIT_ACTIONS } from '../constants/subscription-plan-audit-actions.constant';
import type { CreateSubscriptionPlanDto } from '../dto/create-subscription-plan.dto';
import {
  SUBSCRIPTION_PLAN_LIST_STATUS,
  type SubscriptionPlanListStatus,
} from '../dto/list-subscription-plans-query.dto';
import type { UpdateSubscriptionPlanDto } from '../dto/update-subscription-plan.dto';
import { formatPaymentAmount } from '../utils/payment-amount.util';
import {
  calculateDiscountedPrice,
  findPublicPlanDiscount,
  planDiscountScheduleStatus,
  type PlanDiscountScheduleStatus,
} from '../utils/subscription-plan-discount.util';
import { decidePlanRemoval } from '../utils/subscription-plan-removal.util';

const PLAN_SELECT = {
  id: true,
  name: true,
  billingCycle: true,
  durationInDays: true,
  price: true,
  isActive: true,
  createdAt: true,
  discounts: {
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
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
} satisfies Prisma.SubscriptionPlanSelect;

type PlanDiscountRecord = {
  id: number;
  code: string | null;
  discountType: DiscountType;
  value: number;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
};

type PlanRecord = {
  id: number;
  name: string;
  billingCycle: SubscriptionBillingCycle;
  durationInDays: number;
  price: Prisma.Decimal;
  isActive: boolean;
  createdAt: Date;
  discounts: PlanDiscountRecord[];
};

export interface ActivePlanDiscountResponse {
  id: number;
  /** Present on platform responses. Omitted from the tenant catalog. */
  code?: string | null;
  discountType: DiscountType;
  value: number;
  startsAt: string;
  endsAt: string;
}

export interface PlanDiscountResponse extends ActivePlanDiscountResponse {
  isActive: boolean;
  status: PlanDiscountScheduleStatus;
}

export interface SubscriptionPlanResponse {
  id: number;
  name: string;
  billingCycle: SubscriptionBillingCycle;
  durationInDays: number;
  price: string;
  effectivePrice: string;
  activeDiscount: ActivePlanDiscountResponse | null;
  discounts: PlanDiscountResponse[];
  isActive: boolean;
  createdAt: string;
}

export interface SubscriptionPlanRemovalResponse {
  deleted: boolean;
  deactivated: boolean;
  message: string;
  plan: SubscriptionPlanResponse | null;
}

export interface InitializeSubscriptionPlansResponse {
  created: boolean;
  plans: SubscriptionPlanResponse[];
}

@Injectable()
export class SubscriptionPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
  ) {}

  async create(
    dto: CreateSubscriptionPlanDto,
    audit: AuditContext,
  ): Promise<SubscriptionPlanResponse> {
    const name = requirePlanName(dto.name);
    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        name,
        billingCycle: dto.billingCycle,
        durationInDays: dto.durationInDays,
        price: new Prisma.Decimal(dto.price),
        isActive: true,
      },
      select: PLAN_SELECT,
    });

    this.audit(audit, {
      action: SUBSCRIPTION_PLAN_AUDIT_ACTIONS.CREATED,
      targetId: String(plan.id),
      payload: {
        name: plan.name,
        billingCycle: plan.billingCycle,
        durationInDays: plan.durationInDays,
        price: formatPaymentAmount(plan.price),
        isActive: true,
      },
    });

    return toPlanResponse(plan);
  }

  async list(
    status: SubscriptionPlanListStatus,
  ): Promise<SubscriptionPlanResponse[]> {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: statusWhere(status),
      select: PLAN_SELECT,
      orderBy: [{ durationInDays: 'asc' }, { price: 'asc' }, { id: 'asc' }],
    });

    return plans.map((plan) => toPlanResponse(plan));
  }

  async listActiveCatalog(): Promise<SubscriptionPlanResponse[]> {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: statusWhere(SUBSCRIPTION_PLAN_LIST_STATUS.ACTIVE),
      select: PLAN_SELECT,
      orderBy: [{ durationInDays: 'asc' }, { price: 'asc' }, { id: 'asc' }],
    });

    return plans.map((plan) =>
      toPlanResponse(plan, new Date(), { includeCoupons: false }),
    );
  }

  async findOne(id: number): Promise<PlanRecord> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
      select: PLAN_SELECT,
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan was not found');
    }

    return plan;
  }

  async get(id: number): Promise<SubscriptionPlanResponse> {
    return toPlanResponse(await this.findOne(id));
  }

  async update(
    id: number,
    dto: UpdateSubscriptionPlanDto,
    audit: AuditContext,
  ): Promise<SubscriptionPlanResponse> {
    if (dto.name === undefined && dto.price === undefined) {
      throw new BadRequestException('Provide a name or a price to update');
    }

    const current = await this.findOne(id);
    const name = dto.name === undefined ? undefined : requirePlanName(dto.name);
    const price =
      dto.price === undefined ? undefined : new Prisma.Decimal(dto.price);

    if (price !== undefined) {
      await this.assertPriceCoversFixedDiscounts(id, price);
    }

    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(price !== undefined ? { price } : {}),
      },
      select: PLAN_SELECT,
    });

    this.audit(audit, {
      action: SUBSCRIPTION_PLAN_AUDIT_ACTIONS.UPDATED,
      targetId: String(plan.id),
      payload: {
        ...(name !== undefined
          ? { previousName: current.name, name: plan.name }
          : {}),
        ...(price !== undefined
          ? {
              previousPrice: formatPaymentAmount(current.price),
              price: formatPaymentAmount(plan.price),
            }
          : {}),
      },
    });

    return toPlanResponse(plan);
  }

  async updateStatus(
    id: number,
    isActive: boolean,
    audit: AuditContext,
  ): Promise<SubscriptionPlanResponse> {
    const current = await this.findOne(id);
    if (current.isActive === isActive) {
      return toPlanResponse(current);
    }

    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive },
      select: PLAN_SELECT,
    });

    this.audit(audit, {
      action: SUBSCRIPTION_PLAN_AUDIT_ACTIONS.STATUS_CHANGED,
      targetId: String(plan.id),
      payload: {
        previousIsActive: current.isActive,
        isActive: plan.isActive,
      },
    });

    return toPlanResponse(plan);
  }

  async remove(
    id: number,
    audit: AuditContext,
  ): Promise<SubscriptionPlanRemovalResponse> {
    const plan = await this.findOne(id);
    const referenceCount = await this.countReferences(id);

    if (decidePlanRemoval(referenceCount) === 'delete') {
      await this.prisma.subscriptionPlan.delete({ where: { id } });
      this.audit(audit, {
        action: SUBSCRIPTION_PLAN_AUDIT_ACTIONS.DELETED,
        targetId: String(id),
        payload: { name: plan.name },
      });

      return {
        deleted: true,
        deactivated: false,
        message: 'Subscription plan deleted',
        plan: null,
      };
    }

    const deactivated =
      plan.isActive === false
        ? plan
        : await this.prisma.subscriptionPlan.update({
            where: { id },
            data: { isActive: false },
            select: PLAN_SELECT,
          });

    this.audit(audit, {
      action: SUBSCRIPTION_PLAN_AUDIT_ACTIONS.DELETE_BLOCKED,
      targetId: String(id),
      payload: {
        name: plan.name,
        referenceCount,
        previousIsActive: plan.isActive,
        isActive: false,
      },
    });

    return {
      deleted: false,
      deactivated: true,
      message: plan.isActive
        ? 'Deletion is not possible because this plan has subscription or payment history. It has been deactivated instead.'
        : 'Deletion is not possible because this plan has subscription or payment history. It is already deactivated.',
      plan: toPlanResponse(deactivated),
    };
  }

  async initialize(
    audit: AuditContext,
  ): Promise<InitializeSubscriptionPlansResponse> {
    const existingCount = await this.prisma.subscriptionPlan.count();
    if (existingCount > 0) {
      return {
        created: false,
        plans: await this.list(SUBSCRIPTION_PLAN_LIST_STATUS.ALL),
      };
    }

    await this.prisma.subscriptionPlan.createMany({
      data: DEFAULT_SUBSCRIPTION_PLANS.map((plan) => ({
        name: plan.name,
        billingCycle: plan.billingCycle,
        durationInDays: plan.durationInDays,
        price: new Prisma.Decimal(plan.price),
        isActive: true,
      })),
    });

    const plans = await this.list(SUBSCRIPTION_PLAN_LIST_STATUS.ALL);
    this.audit(audit, {
      action: SUBSCRIPTION_PLAN_AUDIT_ACTIONS.INITIALIZED,
      payload: {
        plans: plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          billingCycle: plan.billingCycle,
          durationInDays: plan.durationInDays,
          price: plan.price,
        })),
      },
    });

    return { created: true, plans };
  }

  private async assertPriceCoversFixedDiscounts(
    planId: number,
    price: Prisma.Decimal,
  ): Promise<void> {
    const discounts = await this.prisma.planDiscount.findMany({
      where: {
        planId,
        isActive: true,
        discountType: DiscountType.FIXED_AMOUNT,
        endsAt: { gte: new Date() },
      },
      select: { value: true },
    });
    const blocksPrice = discounts.some((discount) =>
      new Prisma.Decimal(discount.value).greaterThan(price),
    );

    if (blocksPrice) {
      throw new BadRequestException(
        'The new price is below an active fixed discount',
      );
    }
  }

  private async countReferences(planId: number): Promise<number> {
    const [subscriptions, transactions] = await Promise.all([
      this.prisma.subscription.count({ where: { planId } }),
      this.prisma.paymentTransaction.count({ where: { planId } }),
    ]);

    return subscriptions + transactions;
  }

  private audit(
    audit: AuditContext,
    input: {
      action: string;
      targetId?: string;
      payload?: Record<string, unknown>;
    },
  ): void {
    this.auditEmitter.emit({
      ...audit,
      tenantId: null,
      module: 'SUBSCRIPTIONS',
      action: input.action,
      targetType: 'SubscriptionPlan',
      targetId: input.targetId,
      payload: input.payload,
    });
  }
}

export function toPlanResponse(
  plan: PlanRecord,
  now = new Date(),
  options?: { includeCoupons?: boolean },
): SubscriptionPlanResponse {
  const includeCoupons = options?.includeCoupons !== false;
  const publicDiscounts = plan.discounts.filter((discount) => !discount.code);
  const visible = includeCoupons ? plan.discounts : publicDiscounts;
  const active = findPublicPlanDiscount(now, publicDiscounts);

  return {
    id: plan.id,
    name: plan.name,
    billingCycle: plan.billingCycle,
    durationInDays: plan.durationInDays,
    price: formatPaymentAmount(plan.price),
    effectivePrice: formatPaymentAmount(
      calculateDiscountedPrice(plan.price, active),
    ),
    activeDiscount: active
      ? toActiveDiscountResponse(active, includeCoupons)
      : null,
    discounts: visible.map((discount) => ({
      ...toActiveDiscountResponse(discount, includeCoupons),
      isActive: discount.isActive,
      status: planDiscountScheduleStatus(now, discount),
    })),
    isActive: plan.isActive,
    createdAt: plan.createdAt.toISOString(),
  };
}

function toActiveDiscountResponse(
  discount: PlanDiscountRecord,
  includeCoupons: boolean,
): ActivePlanDiscountResponse {
  return {
    id: discount.id,
    ...(includeCoupons ? { code: discount.code } : {}),
    discountType: discount.discountType,
    value: discount.value,
    startsAt: discount.startsAt.toISOString(),
    endsAt: discount.endsAt.toISOString(),
  };
}

function requirePlanName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new BadRequestException('Plan name is required');
  }

  return trimmed;
}

function statusWhere(status: SubscriptionPlanListStatus): {
  isActive?: boolean;
} {
  if (status === SUBSCRIPTION_PLAN_LIST_STATUS.ACTIVE) {
    return { isActive: true };
  }

  if (status === SUBSCRIPTION_PLAN_LIST_STATUS.DEACTIVATED) {
    return { isActive: false };
  }

  return {};
}

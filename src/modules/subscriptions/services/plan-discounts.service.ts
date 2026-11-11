import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiscountType, Prisma } from '@prisma/client';
import type { AuditContext } from '../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { SUBSCRIPTION_PLAN_AUDIT_ACTIONS } from '../constants/subscription-plan-audit-actions.constant';
import type { CreatePlanDiscountDto } from '../dto/create-plan-discount.dto';
import type { UpdatePlanDiscountDto } from '../dto/update-plan-discount.dto';
import { timestampToSeconds } from '../utils/subscription-coverage.util';
import {
  discountValueError,
  normalizeDiscountCode,
} from '../utils/subscription-plan-discount.util';
import {
  SubscriptionPlansService,
  type SubscriptionPlanResponse,
} from './subscription-plans.service';

interface DiscountDraft {
  discountType: DiscountType;
  value: number;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  code: string | null;
}

@Injectable()
export class PlanDiscountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: SubscriptionPlansService,
    private readonly auditEmitter: AuditEmitterService,
  ) {}

  async create(
    planId: number,
    dto: CreatePlanDiscountDto,
    audit: AuditContext,
  ): Promise<SubscriptionPlanResponse> {
    const plan = await this.plans.findOne(planId);
    const draft: DiscountDraft = {
      discountType: dto.discountType,
      value: dto.value,
      ...requireDiscountWindow(dto.startsAt, dto.endsAt),
      isActive: true,
      code: normalizeStoredDiscountCode(dto.code),
    };
    this.assertValue(draft, plan.price);

    const discount = await this.prisma.$transaction(async (tx) => {
      await this.lockPlan(tx, planId);
      await this.assertNoPublicOverlap(tx, planId, draft, null);
      return tx.planDiscount.create({
        data: { planId, ...draft },
        select: { id: true },
      });
    });

    this.audit(audit, {
      action: SUBSCRIPTION_PLAN_AUDIT_ACTIONS.DISCOUNT_CREATED,
      targetId: String(discount.id),
      payload: { planId, ...discountPayload(draft) },
    });

    return this.plans.get(planId);
  }

  async update(
    planId: number,
    discountId: number,
    dto: UpdatePlanDiscountDto,
    audit: AuditContext,
  ): Promise<SubscriptionPlanResponse> {
    if (
      dto.discountType === undefined &&
      dto.value === undefined &&
      dto.startsAt === undefined &&
      dto.endsAt === undefined &&
      dto.isActive === undefined &&
      dto.code === undefined
    ) {
      throw new BadRequestException('Provide a discount field to update');
    }

    const plan = await this.plans.findOne(planId);
    const current = await this.findDiscount(planId, discountId);
    const draft: DiscountDraft = {
      discountType: dto.discountType ?? current.discountType,
      value: dto.value ?? current.value,
      ...requireDiscountWindow(
        dto.startsAt ?? current.startsAt,
        dto.endsAt ?? current.endsAt,
      ),
      isActive: dto.isActive ?? current.isActive,
      code:
        dto.code === undefined
          ? current.code
          : normalizeStoredDiscountCode(dto.code),
    };
    this.assertValue(draft, plan.price);

    await this.prisma.$transaction(async (tx) => {
      await this.lockPlan(tx, planId);
      if (draft.isActive) {
        await this.assertNoPublicOverlap(tx, planId, draft, discountId);
      }
      await tx.planDiscount.update({
        where: { id: discountId },
        data: draft,
      });
    });

    this.audit(audit, {
      action: SUBSCRIPTION_PLAN_AUDIT_ACTIONS.DISCOUNT_UPDATED,
      targetId: String(discountId),
      payload: {
        planId,
        previous: discountPayload(current),
        ...discountPayload(draft),
      },
    });

    return this.plans.get(planId);
  }

  async remove(
    planId: number,
    discountId: number,
    audit: AuditContext,
  ): Promise<SubscriptionPlanResponse> {
    await this.plans.findOne(planId);
    const current = await this.findDiscount(planId, discountId);
    await this.prisma.planDiscount.delete({ where: { id: discountId } });

    this.audit(audit, {
      action: SUBSCRIPTION_PLAN_AUDIT_ACTIONS.DISCOUNT_DELETED,
      targetId: String(discountId),
      payload: { planId, ...discountPayload(current) },
    });

    return this.plans.get(planId);
  }

  private assertValue(draft: DiscountDraft, price: Prisma.Decimal): void {
    const message = discountValueError({
      discountType: draft.discountType,
      value: draft.value,
      price,
    });

    if (message) {
      throw new BadRequestException(message);
    }
  }

  private async findDiscount(planId: number, discountId: number) {
    const discount = await this.prisma.planDiscount.findFirst({
      where: { id: discountId, planId },
      select: {
        id: true,
        code: true,
        discountType: true,
        value: true,
        startsAt: true,
        endsAt: true,
        isActive: true,
      },
    });

    if (!discount) {
      throw new NotFoundException('Plan discount was not found');
    }

    return discount;
  }

  private async lockPlan(
    tx: Prisma.TransactionClient,
    planId: number,
  ): Promise<void> {
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM subscription_plans WHERE id = ${planId} FOR UPDATE`,
    );
  }

  private async assertNoPublicOverlap(
    tx: Prisma.TransactionClient,
    planId: number,
    draft: DiscountDraft,
    excludeId: number | null,
  ): Promise<void> {
    if (draft.code) {
      return;
    }

    const overlap = await tx.planDiscount.findFirst({
      where: {
        planId,
        isActive: true,
        code: null,
        ...(excludeId === null ? {} : { id: { not: excludeId } }),
        startsAt: { lt: draft.endsAt },
        endsAt: { gt: draft.startsAt },
      },
      select: { id: true },
    });

    if (overlap) {
      throw new ConflictException(
        'Another active discount already covers this period',
      );
    }
  }

  private audit(
    audit: AuditContext,
    input: {
      action: string;
      targetId: string;
      payload: Record<string, unknown>;
    },
  ): void {
    this.auditEmitter.emit({
      ...audit,
      tenantId: null,
      module: 'SUBSCRIPTIONS',
      action: input.action,
      targetType: 'PlanDiscount',
      targetId: input.targetId,
      payload: input.payload,
    });
  }
}

function requireDiscountWindow(
  startsAt: Date,
  endsAt: Date,
): { startsAt: Date; endsAt: Date } {
  const start = timestampToSeconds(startsAt);
  const end = timestampToSeconds(endsAt);
  if (!(start < end)) {
    throw new BadRequestException('Discount start must be before the end');
  }

  return { startsAt: start, endsAt: end };
}

function normalizeStoredDiscountCode(
  code: string | null | undefined,
): string | null {
  if (code == null) {
    return null;
  }

  const trimmed = code.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function discountPayload(discount: DiscountDraft): Record<string, unknown> {
  return {
    code: discount.code ? normalizeDiscountCode(discount.code) : null,
    discountType: discount.discountType,
    value: discount.value,
    startsAt: discount.startsAt.toISOString(),
    endsAt: discount.endsAt.toISOString(),
    isActive: discount.isActive,
  };
}

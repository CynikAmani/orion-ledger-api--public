import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { formatDisplayDate } from '../../../../common/utils/format-date.util';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../core/audit/services/audit-emitter.service';
import { SYSTEM_SCHEDULER_AUDIT_CONTEXT } from '../../../../core/audit/utils/audit-request-context.util';
import { PrismaService } from '../../../../core/database/prisma.service';
import { NOTIFICATION_ACTIONS } from '../../../../core/notifications/constants/notification-action-keys.constant';
import { NotificationDispatcherService } from '../../../../core/notifications/services/notification-dispatcher.service';
import { resolveTenantBrandName } from '../../../tenants/shared/utils/resolve-tenant-brand-name.util';
import { CreatePromotionDto } from '../dto/create-promotion.dto';

const PROMOTION_SELECT = {
  promotionId: true,
  discount: true,
  startDate: true,
  endDate: true,
  isActive: true,
  expiringSoonNotifiedAt: true,
} as const;

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface PromotionResponse {
  promotionId: number;
  discount: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
    private readonly notificationDispatcher: NotificationDispatcherService,
  ) {}

  async create(
    tenantId: string,
    dto: CreatePromotionDto,
    auditContext: AuditContext,
  ): Promise<PromotionResponse> {
    this.assertValidDateRange(dto.startDate, dto.endDate);
    await this.assertNoOverlap(tenantId, dto.startDate, dto.endDate);

    const promotion = await this.prisma.promotion.create({
      data: {
        tenantId,
        discount: dto.discount,
        startDate: dto.startDate,
        endDate: dto.endDate,
        isActive: false,
      },
      select: PROMOTION_SELECT,
    });

    this.emitAudit(auditContext, tenantId, {
      action: 'PROMOTION_CREATED',
      targetId: String(promotion.promotionId),
      payload: {
        discount: dto.discount,
        startDate: dto.startDate.toISOString(),
        endDate: dto.endDate.toISOString(),
      },
    });

    await this.syncLifecycleForTenant(tenantId);

    return this.toResponse(
      await this.findOneOrThrow(tenantId, promotion.promotionId),
    );
  }

  async findActive(tenantId: string): Promise<PromotionResponse | null> {
    const now = new Date();

    const promotion = await this.prisma.promotion.findFirst({
      where: {
        tenantId,
        isActive: true,
        startDate: { lte: now },
        endDate: { gt: now },
      },
      select: PROMOTION_SELECT,
      orderBy: { startDate: 'asc' },
    });

    return promotion ? this.toResponse(promotion) : null;
  }

  findPublic(tenantId: string): Promise<PromotionResponse | null> {
    return this.findActive(tenantId);
  }

  async findUpcoming(tenantId: string): Promise<PromotionResponse[]> {
    const now = new Date();

    const promotions = await this.prisma.promotion.findMany({
      where: {
        tenantId,
        startDate: { gt: now },
      },
      select: PROMOTION_SELECT,
      orderBy: { startDate: 'asc' },
    });

    return promotions.map((promotion) => this.toResponse(promotion));
  }

  async findHistory(tenantId: string): Promise<PromotionResponse[]> {
    const now = new Date();

    const promotions = await this.prisma.promotion.findMany({
      where: {
        tenantId,
        endDate: { lte: now },
      },
      select: PROMOTION_SELECT,
      orderBy: { endDate: 'desc' },
    });

    return promotions.map((promotion) => this.toResponse(promotion));
  }

  async cancel(
    tenantId: string,
    promotionId: number,
    auditContext: AuditContext,
  ): Promise<{ message: string }> {
    const promotion = await this.findOneOrThrow(tenantId, promotionId);

    if (promotion.isActive) {
      await this.restoreInterestRatesToStandard(tenantId);
    }

    await this.prisma.promotion.delete({
      where: { promotionId },
    });

    this.emitAudit(auditContext, tenantId, {
      action: 'PROMOTION_CANCELLED',
      targetId: String(promotionId),
      payload: {
        discount: promotion.discount,
        startDate: promotion.startDate.toISOString(),
        endDate: promotion.endDate.toISOString(),
        wasActive: promotion.isActive,
      },
    });

    const notice = await this.promotionNoticeData(tenantId, promotion);
    await this.notificationDispatcher.dispatch(
      NOTIFICATION_ACTIONS.PROMOTIONS.CANCELLED,
      {
        subject: 'Promotion cancelled',
        message: `A ${promotion.discount}% promotion at ${notice.organization} was cancelled.`,
        templateData: {
          promotionId: promotion.promotionId,
          ...notice,
        },
      },
    );

    return { message: 'Promotion cancelled successfully' };
  }

  /**
   * Idempotent sweep used by the central scheduler (bootstrap + cron).
   * Runs lifecycle transitions for every tenant independently.
   */
  async syncLifecycle(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { tenantId: true },
    });

    for (const tenant of tenants) {
      await this.syncLifecycleForTenant(tenant.tenantId);
    }
  }

  private async syncLifecycleForTenant(tenantId: string): Promise<void> {
    const now = new Date();

    await this.expireActivePromotionIfDue(tenantId, now);
    await this.activateScheduledPromotionIfDue(tenantId, now);
    await this.notifyExpiringSoonIfDue(tenantId, now);
  }

  private async expireActivePromotionIfDue(
    tenantId: string,
    now: Date,
  ): Promise<void> {
    const activePromotion = await this.prisma.promotion.findFirst({
      where: { tenantId, isActive: true },
      select: PROMOTION_SELECT,
    });

    if (!activePromotion || activePromotion.endDate > now) {
      return;
    }

    await this.restoreInterestRatesToStandard(tenantId);

    await this.prisma.promotion.update({
      where: { promotionId: activePromotion.promotionId },
      data: { isActive: false },
    });

    this.emitAudit(SYSTEM_SCHEDULER_AUDIT_CONTEXT, tenantId, {
      action: 'PROMOTION_AUTO_EXPIRED',
      targetId: String(activePromotion.promotionId),
      payload: {
        discount: activePromotion.discount,
        startDate: activePromotion.startDate.toISOString(),
        endDate: activePromotion.endDate.toISOString(),
      },
    });

    this.logger.log(
      `Expired promotion ${activePromotion.promotionId} for tenant ${tenantId}`,
    );
  }

  private async activateScheduledPromotionIfDue(
    tenantId: string,
    now: Date,
  ): Promise<void> {
    const activePromotion = await this.prisma.promotion.findFirst({
      where: { tenantId, isActive: true },
      select: { promotionId: true },
    });

    if (activePromotion) {
      return;
    }

    const duePromotion = await this.prisma.promotion.findFirst({
      where: {
        tenantId,
        isActive: false,
        startDate: { lte: now },
        endDate: { gt: now },
      },
      select: PROMOTION_SELECT,
      orderBy: { startDate: 'asc' },
    });

    if (!duePromotion) {
      return;
    }

    await this.applyDiscountToInterestRates(tenantId, duePromotion.discount);

    await this.prisma.promotion.update({
      where: { promotionId: duePromotion.promotionId },
      data: { isActive: true },
    });

    this.emitAudit(SYSTEM_SCHEDULER_AUDIT_CONTEXT, tenantId, {
      action: 'PROMOTION_AUTO_ACTIVATED',
      targetId: String(duePromotion.promotionId),
      payload: {
        discount: duePromotion.discount,
        startDate: duePromotion.startDate.toISOString(),
        endDate: duePromotion.endDate.toISOString(),
      },
    });

    const notice = await this.promotionNoticeData(tenantId, duePromotion);
    await this.notificationDispatcher.dispatch(
      NOTIFICATION_ACTIONS.PROMOTIONS.ACTIVATED,
      {
        subject: 'Promotion activated',
        message: `A ${duePromotion.discount}% promotion is now active at ${notice.organization}.`,
        templateData: {
          promotionId: duePromotion.promotionId,
          ...notice,
        },
      },
    );

    this.logger.log(
      `Activated promotion ${duePromotion.promotionId} for tenant ${tenantId} (discount=${duePromotion.discount}%)`,
    );
  }

  private async notifyExpiringSoonIfDue(
    tenantId: string,
    now: Date,
  ): Promise<void> {
    const windowEnd = new Date(now.getTime() + TWENTY_FOUR_HOURS_MS);

    const promotion = await this.prisma.promotion.findFirst({
      where: {
        tenantId,
        isActive: true,
        expiringSoonNotifiedAt: null,
        endDate: {
          gt: now,
          lte: windowEnd,
        },
      },
      select: PROMOTION_SELECT,
    });

    if (!promotion) {
      return;
    }

    const notice = await this.promotionNoticeData(tenantId, promotion);
    await this.notificationDispatcher.dispatch(
      NOTIFICATION_ACTIONS.PROMOTIONS.EXPIRING_SOON,
      {
        subject: 'Promotion expiring soon',
        message: `A ${promotion.discount}% promotion at ${notice.organization} ends within 24 hours.`,
        templateData: {
          promotionId: promotion.promotionId,
          ...notice,
        },
      },
    );

    await this.prisma.promotion.update({
      where: { promotionId: promotion.promotionId },
      data: { expiringSoonNotifiedAt: now },
    });

    this.logger.log(
      `Sent expiring-soon notice for promotion ${promotion.promotionId} (tenant ${tenantId})`,
    );
  }

  private async applyDiscountToInterestRates(
    tenantId: string,
    discount: number,
  ): Promise<void> {
    const rates = await this.prisma.interestRate.findMany({
      where: { tenantId },
      select: { rateId: true, standardRate: true },
    });

    if (rates.length === 0) {
      return;
    }

    await this.prisma.$transaction(
      rates.map((rate) =>
        this.prisma.interestRate.update({
          where: { rateId: rate.rateId },
          data: {
            activeRate: Math.max(0, rate.standardRate - discount),
          },
        }),
      ),
    );
  }

  private async restoreInterestRatesToStandard(
    tenantId: string,
  ): Promise<void> {
    const rates = await this.prisma.interestRate.findMany({
      where: { tenantId },
      select: { rateId: true, standardRate: true },
    });

    if (rates.length === 0) {
      return;
    }

    await this.prisma.$transaction(
      rates.map((rate) =>
        this.prisma.interestRate.update({
          where: { rateId: rate.rateId },
          data: { activeRate: rate.standardRate },
        }),
      ),
    );
  }

  private async promotionNoticeData(
    tenantId: string,
    promotion: { discount: number; startDate: Date; endDate: Date },
  ): Promise<{
    organization: string;
    discount: string;
    startDate: string;
    endDate: string;
  }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { tenantId },
      select: {
        name: true,
        brandProfile: { select: { brandName: true } },
      },
    });

    return {
      organization: resolveTenantBrandName({
        tenantName: tenant?.name,
        brandName: tenant?.brandProfile?.brandName,
      }),
      discount: `${promotion.discount}%`,
      startDate: formatDisplayDate(promotion.startDate),
      endDate: formatDisplayDate(promotion.endDate),
    };
  }

  private assertValidDateRange(startDate: Date, endDate: Date): void {
    if (endDate.getTime() <= startDate.getTime()) {
      throw new BadRequestException('endDate must be after startDate');
    }
  }

  private async assertNoOverlap(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    const overlapping = await this.prisma.promotion.findFirst({
      where: {
        tenantId,
        AND: [{ startDate: { lt: endDate } }, { endDate: { gt: startDate } }],
      },
      select: {
        promotionId: true,
        startDate: true,
        endDate: true,
      },
    });

    if (overlapping) {
      throw new ConflictException(
        `Promotion date range overlaps with existing promotion ${overlapping.promotionId} (${overlapping.startDate.toISOString()} – ${overlapping.endDate.toISOString()})`,
      );
    }
  }

  private emitAudit(
    auditContext: AuditContext,
    tenantId: string,
    params: {
      action: string;
      targetId?: string;
      payload?: Record<string, unknown>;
    },
  ): void {
    this.auditEmitter.emit({
      ...auditContext,
      tenantId,
      module: 'LOAN_CONFIGURATIONS',
      targetType: 'Promotion',
      ...params,
    });
  }

  private toResponse(promotion: {
    promotionId: number;
    discount: number;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
  }): PromotionResponse {
    return {
      promotionId: promotion.promotionId,
      discount: promotion.discount,
      startDate: promotion.startDate,
      endDate: promotion.endDate,
      isActive: promotion.isActive,
    };
  }

  private async findOneOrThrow(
    tenantId: string,
    promotionId: number,
  ): Promise<{
    promotionId: number;
    discount: number;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    expiringSoonNotifiedAt: Date | null;
  }> {
    const promotion = await this.prisma.promotion.findFirst({
      where: { tenantId, promotionId },
      select: PROMOTION_SELECT,
    });

    if (!promotion) {
      throw new NotFoundException(`Promotion with ID ${promotionId} not found`);
    }

    return promotion;
  }
}

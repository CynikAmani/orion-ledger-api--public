import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DiscountType,
  Prisma,
  SpecialOfferStatus,
  type SpecialOffer,
  type SpecialOfferConfig,
} from '@prisma/client';
import type { AuditContext } from '../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { BrevoEmailService } from '../../../core/email/services/brevo-email.service';
import { NOTIFICATION_ACTIONS } from '../../../core/notifications/constants/notification-action-keys.constant';
import { NOTIFICATION_TYPES } from '../../../core/notifications/constants/notification-type.constant';
import { NotificationDispatcherService } from '../../../core/notifications/services/notification-dispatcher.service';
import { NotificationsService } from '../../../core/notifications/services/notifications.service';
import { formatDisplayDateTime } from '../../../common/utils/format-date.util';
import { TenantBrandNameService } from '../../tenants/shared/services/tenant-brand-name.service';
import {
  LOAN_CLEARED_EVENT,
  SYSTEM_SPECIAL_OFFER_AUDIT_CONTEXT,
  type LoanClearedEvent,
} from '../constants/special-offer.constants';
import { buildSpecialOfferAwardedEmail } from '../templates/special-offer-awarded.email';

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class RewardEngineService {
  private readonly logger = new Logger(RewardEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
    private readonly emailService: BrevoEmailService,
    private readonly notificationDispatcher: NotificationDispatcherService,
    private readonly notificationsService: NotificationsService,
    private readonly tenantBrandNameService: TenantBrandNameService,
  ) {}

  /**
   * Loose coupling hook for Loan Management:
   * emit `{ event: LOAN_CLEARED_EVENT, customerId, tenantId }` or inject this service
   * and call {@link evaluateLoanClearance} after marking a loan cleared.
   */
  @OnEvent(LOAN_CLEARED_EVENT, { async: true })
  async onLoanCleared(event: LoanClearedEvent): Promise<void> {
    if (!event?.customerId || !event?.tenantId) {
      this.logger.warn(
        'Ignoring loan.cleared event without customerId or tenantId',
      );
      return;
    }

    try {
      await this.evaluateLoanClearance(event.customerId, event.tenantId);
    } catch (error) {
      this.logger.error(
        `Reward evaluation failed for customer ${event.customerId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Evaluate loyalty reward eligibility after a loan clearance.
   * Increments clearance counters regardless; issues an offer only when
   * automation is enabled and eligibility checks pass.
   */
  async evaluateLoanClearance(
    customerId: number,
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SpecialOffer | null> {
    const db: DbClient = tx ?? this.prisma;

    const config = await db.specialOfferConfig.findUnique({
      where: { tenantId },
    });

    if (!config?.isEnabled) {
      this.logger.debug(
        `Reward engine skipped for ${customerId}: automation disabled or tenant config missing`,
      );
      return null;
    }

    const activity = await this.incrementClearanceCounters(
      db,
      customerId,
      tenantId,
    );

    if (activity.loansSinceLastOffer < config.loanInterval) {
      this.logger.debug(
        `Customer ${customerId} not yet eligible (${activity.loansSinceLastOffer}/${config.loanInterval})`,
      );
      return null;
    }

    if (activity.defaultedLoansCount > 0 && !config.allowDefaultedUsers) {
      this.logger.debug(
        `Customer ${customerId} bypassed: defaulted loans present and allowDefaultedUsers=false`,
      );
      return null;
    }

    const now = new Date();
    const expiresAt = this.addDays(now, config.validForDays);

    const offer = await db.specialOffer.create({
      data: {
        tenantId,
        targetCustomer: customerId,
        // null issuedById = system/automated grant (no User row to join)
        issuedById: null,
        discountType: config.discountType,
        discountValue: config.discountValue,
        status: SpecialOfferStatus.AVAILABLE,
        isModalDismissed: false,
        issuedAt: now,
        expiresAt,
        issuedReason: `Automated loyalty reward after ${config.loanInterval} cleared loans interval`,
      },
    });

    await db.customerLoanActivity.update({
      where: { customerId_tenantId: { customerId, tenantId } },
      data: {
        loansSinceLastOffer: 0,
        lastOfferIssuedAt: now,
      },
    });

    this.emitAudit(SYSTEM_SPECIAL_OFFER_AUDIT_CONTEXT, {
      action: 'SPECIAL_OFFER_ISSUED_AUTOMATED',
      targetId: String(offer.id),
      payload: {
        customerId,
        discountType: offer.discountType,
        discountValue: Number(offer.discountValue),
        loanInterval: config.loanInterval,
      },
    });

    // Side effects outside an external transaction so callers can commit first
    if (!tx) {
      await this.notifyAutomatedOffer(offer, config);
    } else {
      // Defer notifications when nested in a caller transaction
      void this.notifyAutomatedOffer(offer, config);
    }

    return offer;
  }

  private async incrementClearanceCounters(
    db: DbClient,
    customerId: number,
    tenantId: string,
  ): Promise<{
    loansSinceLastOffer: number;
    defaultedLoansCount: number;
    clearedLoansCount: number;
  }> {
    const activity = await db.customerLoanActivity.upsert({
      where: { customerId_tenantId: { customerId, tenantId } },
      create: {
        customerId,
        tenantId,
        clearedLoansCount: 1,
        loansSinceLastOffer: 1,
      },
      update: {
        clearedLoansCount: { increment: 1 },
        loansSinceLastOffer: { increment: 1 },
      },
      select: {
        loansSinceLastOffer: true,
        defaultedLoansCount: true,
        clearedLoansCount: true,
      },
    });

    return activity;
  }

  private async notifyAutomatedOffer(
    offer: SpecialOffer,
    config: SpecialOfferConfig,
  ): Promise<void> {
    const customer = await this.prisma.user.findUnique({
      where: { id: offer.targetCustomer },
      select: { id: true, userId: true, email: true, fullname: true },
    });

    if (!customer) {
      return;
    }

    const discountLabel = this.formatDiscountLabel(
      offer.discountType,
      offer.discountValue,
    );

    this.notificationsService.push({
      targetUser: customer.id,
      type: NOTIFICATION_TYPES.INFO,
      content: `You earned a special offer: ${discountLabel}. Redeem before ${formatDisplayDateTime(offer.expiresAt)}.`,
    });

    const brandName = await this.tenantBrandNameService.resolveDisplayName(
      offer.tenantId,
    );

    if (customer.email) {
      const emailContent = buildSpecialOfferAwardedEmail({
        fullname: customer.fullname,
        brandName,
        discountLabel,
        expiresAt: offer.expiresAt,
        issuedBySystem: true,
      });

      void this.emailService.send({
        to: customer.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
    }

    await this.notificationDispatcher.dispatch(
      NOTIFICATION_ACTIONS.SPECIAL_OFFERS.ISSUED_AUTOMATED,
      {
        subject: 'Special offer auto-issued',
        message: `Loyalty offer (${discountLabel}) was issued to ${customer.fullname} at ${brandName}. Staff may cancel if necessary.`,
        templateData: {
          organization: brandName,
          customerName: customer.fullname,
          offerLabel: discountLabel,
          expiresAt: formatDisplayDateTime(offer.expiresAt),
        },
      },
    );
  }

  private formatDiscountLabel(
    discountType: DiscountType,
    discountValue: Prisma.Decimal,
  ): string {
    const value = Number(discountValue);
    return discountType === DiscountType.PERCENTAGE
      ? `${value}% off`
      : `MWK ${value.toLocaleString()} off`;
  }

  private addDays(from: Date, days: number): Date {
    const result = new Date(from);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  private emitAudit(
    auditContext: AuditContext,
    params: {
      action: string;
      targetId: string;
      payload?: Record<string, unknown>;
    },
  ): void {
    this.auditEmitter.emit({
      ...auditContext,
      module: 'SPECIAL_OFFERS',
      targetType: 'SpecialOffer',
      ...params,
    });
  }
}

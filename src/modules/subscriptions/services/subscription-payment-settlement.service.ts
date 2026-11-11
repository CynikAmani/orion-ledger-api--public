import { ConflictException, Injectable, Logger } from '@nestjs/common';
import {
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionStatus,
  Prisma,
  SubscriptionStatus,
  SubscriptionType,
} from '@prisma/client';
import { formatDisplayDate } from '../../../common/utils/format-date.util';
import { AuditEmitterService } from '../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { PLATFORM_NOTIFICATION_ACTIONS } from '../../../core/notifications/constants/notification-action-keys.constant';
import { NotificationDispatcherService } from '../../../core/notifications/services/notification-dispatcher.service';
import type { VerifiedPayment } from '../../online-payments/interfaces/payment-provider-client.interface';
import {
  type AppliedOnlinePayment,
  type OnlinePaymentSettlement,
} from '../../online-payments/settlement/online-payment-settlement';
import {
  ONLINE_PAYMENT_AUDIT_SOURCE,
  SUBSCRIPTION_PAYMENT_AUDIT_ACTIONS,
} from '../constants/subscription-payment-audit-actions.constant';
import { resolveTenantBrandName } from '../../tenants/shared/utils/resolve-tenant-brand-name.util';
import { formatPaymentAmount } from '../utils/payment-amount.util';
import { findPaymentVerificationMismatch } from '../utils/payment-verification.util';
import {
  addDurationInDays,
  nextScheduledStart,
  subscriptionWindowsOverlap,
  timestampToSeconds,
} from '../utils/subscription-coverage.util';

export type SubscriptionSettlementOutcome =
  | 'settled'
  | 'already_settled'
  | 'pending'
  | 'failed'
  | 'cancelled'
  | 'not_found'
  | 'mismatch';

export interface SubscriptionSettlementResult {
  outcome: SubscriptionSettlementOutcome;
  transactionReference: string;
  paymentTransactionId?: string;
  subscriptionId?: string;
}

type SettlementPayment = {
  id: string;
  transactionReference: string;
  tenantId: string;
  planId: number;
  durationInDays: number;
  initiatedById: number | null;
  amount: Prisma.Decimal;
  currency: string;
  providerTransactionId: string | null;
  status: PaymentTransactionStatus;
  failureReason: string | null;
  initiatedBy: { email: string | null } | null;
};

@Injectable()
export class SubscriptionPaymentSettlementService implements OnlinePaymentSettlement {
  private readonly logger = new Logger(
    SubscriptionPaymentSettlementService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
    private readonly notificationDispatcher: NotificationDispatcherService,
  ) {}

  async applyVerifiedPayment(
    verified: VerifiedPayment,
  ): Promise<AppliedOnlinePayment> {
    const payment = await this.prisma.paymentTransaction.findUnique({
      where: { transactionReference: verified.transactionReference },
      select: {
        id: true,
        transactionReference: true,
        tenantId: true,
        planId: true,
        durationInDays: true,
        initiatedById: true,
        amount: true,
        currency: true,
        providerTransactionId: true,
        status: true,
        failureReason: true,
        initiatedBy: { select: { email: true } },
      },
    });

    if (!payment) {
      this.logger.warn(
        `No subscription payment found for txRef=${verified.transactionReference}`,
      );
      return { outcome: 'not_found' };
    }

    if (payment.status === PaymentTransactionStatus.SUCCESS) {
      return { outcome: 'already_settled' };
    }

    if (payment.durationInDays < 1) {
      const reason = 'Stored plan duration cannot grant a subscription window';
      await this.recordMismatch(payment, reason);
      return { outcome: 'mismatch' };
    }

    if (payment.status === PaymentTransactionStatus.PENDING) {
      await this.prisma.paymentTransaction.update({
        where: { id: payment.id },
        data: { status: PaymentTransactionStatus.PROCESSING },
      });
    }

    this.logger.log(
      `Applying verified charge txRef=${verified.transactionReference} paymentId=${payment.id} providerStatus=${verified.status} initiatedBy=${payment.initiatedById ?? 'none'}`,
    );

    const mismatch = findPaymentVerificationMismatch(payment, verified);
    if (mismatch) {
      await this.recordMismatch(
        payment,
        mismatch,
        verified.providerTransactionId,
      );
      return { outcome: 'mismatch' };
    }

    if (verified.status === 'success') {
      return this.grantSubscription(payment, verified);
    }

    if (verified.status === 'failed' || verified.status === 'cancelled') {
      return this.recordTerminalFailure(payment, verified);
    }

    return { outcome: 'pending' };
  }

  /**
   * PayChangu verify answered HTTP 400: there is no charge to report.
   * Close the local checkout. This is not a provider cancel webhook.
   */
  async recordCheckoutWithoutPayment(
    transactionReference: string,
    reason: string,
  ): Promise<AppliedOnlinePayment> {
    const payment = await this.prisma.paymentTransaction.findUnique({
      where: { transactionReference },
      select: {
        id: true,
        transactionReference: true,
        tenantId: true,
        planId: true,
        durationInDays: true,
        initiatedById: true,
        amount: true,
        currency: true,
        providerTransactionId: true,
        status: true,
        failureReason: true,
        initiatedBy: { select: { email: true } },
      },
    });

    if (!payment) {
      return { outcome: 'not_found' };
    }

    if (payment.status === PaymentTransactionStatus.SUCCESS) {
      return { outcome: 'already_settled' };
    }

    if (
      payment.status === PaymentTransactionStatus.FAILED ||
      payment.status === PaymentTransactionStatus.EXPIRED
    ) {
      return { outcome: 'failed' };
    }

    if (payment.status === PaymentTransactionStatus.CANCELLED) {
      return { outcome: 'cancelled' };
    }

    const updated = await this.prisma.paymentTransaction.updateMany({
      where: {
        id: payment.id,
        status: {
          in: [
            PaymentTransactionStatus.PENDING,
            PaymentTransactionStatus.PROCESSING,
          ],
        },
      },
      data: {
        status: PaymentTransactionStatus.CANCELLED,
        failedAt: timestampToSeconds(new Date()),
        failureReason: reason,
      },
    });

    if (updated.count === 0) {
      const current = await this.prisma.paymentTransaction.findUnique({
        where: { id: payment.id },
        select: { status: true },
      });
      if (current?.status === PaymentTransactionStatus.SUCCESS) {
        return { outcome: 'already_settled' };
      }
      if (current?.status === PaymentTransactionStatus.CANCELLED) {
        return { outcome: 'cancelled' };
      }
      return { outcome: 'failed' };
    }

    this.auditPayment(payment, SUBSCRIPTION_PAYMENT_AUDIT_ACTIONS.CANCELLED, {
      previousStatus: payment.status,
      status: PaymentTransactionStatus.CANCELLED,
      failureReason: reason,
      providerStatus: 'no_payment',
    });

    this.logger.log(
      `Checkout closed with no PayChangu payment txRef=${payment.transactionReference} paymentId=${payment.id}`,
    );

    return { outcome: 'cancelled' };
  }

  private async grantSubscription(
    payment: SettlementPayment,
    verified: VerifiedPayment,
  ): Promise<SubscriptionSettlementResult> {
    try {
      const settled = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw(
          Prisma.sql`SELECT tenant_id FROM tenants WHERE tenant_id = ${payment.tenantId} FOR UPDATE`,
        );
        await tx.$executeRaw(
          Prisma.sql`SELECT id FROM payment_transactions WHERE id = ${payment.id}::uuid FOR UPDATE`,
        );

        const current = await tx.paymentTransaction.findUnique({
          where: { id: payment.id },
          select: { status: true },
        });

        if (current?.status === PaymentTransactionStatus.SUCCESS) {
          return { alreadySettled: true as const };
        }

        const existing = await tx.subscription.findUnique({
          where: { paymentTransactionId: payment.id },
          select: { id: true },
        });

        if (existing) {
          return {
            alreadySettled: true as const,
            subscriptionId: existing.id,
          };
        }

        const plan = await tx.subscriptionPlan.findUnique({
          where: { id: payment.planId },
          select: { id: true, name: true },
        });

        const now = new Date();
        const openWindows = await tx.subscription.findMany({
          where: { tenantId: payment.tenantId, endsAt: { gt: now } },
          select: { startsAt: true, endsAt: true },
        });
        const startsAt = nextScheduledStart(now, openWindows);
        const window = {
          startsAt,
          endsAt: addDurationInDays(startsAt, payment.durationInDays),
        };
        if (
          openWindows.some((existing) =>
            subscriptionWindowsOverlap(existing, window),
          )
        ) {
          throw new ConflictException('This period already has a subscription');
        }

        const subscription = await tx.subscription.create({
          data: {
            tenantId: payment.tenantId,
            planId: plan?.id ?? null,
            type: SubscriptionType.PAID,
            amountPaid: payment.amount,
            paymentMethod: PaymentMethod.ONLINE,
            startsAt: window.startsAt,
            endsAt: window.endsAt,
            paymentTransactionId: payment.id,
          },
          select: { id: true, startsAt: true, endsAt: true },
        });

        await tx.paymentTransaction.update({
          where: { id: payment.id },
          data: {
            status: PaymentTransactionStatus.SUCCESS,
            completedAt: timestampToSeconds(now),
            failureReason: null,
            ...(verified.providerTransactionId
              ? { providerTransactionId: verified.providerTransactionId }
              : {}),
          },
        });

        await tx.tenant.update({
          where: { tenantId: payment.tenantId },
          data: {
            subscriptionStatus: SubscriptionStatus.PAID,
            paymentStatus: PaymentStatus.PAID,
            subscriptionAccessEndsAt: window.endsAt,
            ...(plan ? { currentPlanId: plan.id } : {}),
          },
        });

        return {
          alreadySettled: false as const,
          subscriptionId: subscription.id,
          startsAt: subscription.startsAt,
          endsAt: subscription.endsAt,
          planName: plan?.name ?? null,
        };
      });

      if (settled.alreadySettled) {
        return {
          outcome: 'already_settled',
          transactionReference: payment.transactionReference,
          paymentTransactionId: payment.id,
          subscriptionId: settled.subscriptionId,
        };
      }

      const amount = formatPaymentAmount(payment.amount);
      const organization = await this.resolveOrganization(payment.tenantId);
      this.auditEmitter.emitRelated(
        {
          userId: payment.initiatedById ?? undefined,
          userEmail: payment.initiatedBy?.email ?? undefined,
          tenantId: payment.tenantId,
          module: 'SUBSCRIPTIONS',
          action: SUBSCRIPTION_PAYMENT_AUDIT_ACTIONS.GRANTED,
          targetType: 'Subscription',
          targetId: settled.subscriptionId,
          payload: {
            source: ONLINE_PAYMENT_AUDIT_SOURCE,
            transactionReference: payment.transactionReference,
            paymentTransactionId: payment.id,
            initiatedByUserId: payment.initiatedById,
            planId: payment.planId,
            planName: settled.planName,
            amount,
            currency: payment.currency,
            startsAt: settled.startsAt.toISOString(),
            endsAt: settled.endsAt.toISOString(),
            previousStatus: payment.status,
            status: PaymentTransactionStatus.SUCCESS,
          },
        },
        {
          module: 'SUBSCRIPTIONS',
          action: SUBSCRIPTION_PAYMENT_AUDIT_ACTIONS.SETTLED,
          targetType: 'PaymentTransaction',
          targetId: payment.id,
          tenantId: payment.tenantId,
        },
      );

      this.logger.log(
        `Subscription granted txRef=${payment.transactionReference} paymentId=${payment.id} subscriptionId=${settled.subscriptionId} initiatedBy=${payment.initiatedById ?? 'none'}`,
      );

      void this.notificationDispatcher.dispatch(
        PLATFORM_NOTIFICATION_ACTIONS.SUBSCRIPTIONS.CREATED,
        {
          subject: 'Tenant subscription created',
          message: `Online subscription settled for ${organization} (${settled.planName ?? 'plan'}, ${payment.currency} ${amount}).`,
          templateData: {
            organization,
            tenantId: payment.tenantId,
            subscriptionId: settled.subscriptionId,
            planId: payment.planId,
            planName: settled.planName ?? '',
            amount: `${payment.currency} ${amount}`,
            paymentMethod: 'Online',
            transactionReference: payment.transactionReference,
            startsAt: formatDisplayDate(settled.startsAt),
            endsAt: formatDisplayDate(settled.endsAt),
          },
        },
      );

      return {
        outcome: 'settled',
        transactionReference: payment.transactionReference,
        paymentTransactionId: payment.id,
        subscriptionId: settled.subscriptionId,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return {
          outcome: 'already_settled',
          transactionReference: payment.transactionReference,
          paymentTransactionId: payment.id,
        };
      }

      throw error;
    }
  }

  private async recordMismatch(
    payment: SettlementPayment,
    reason: string,
    providerTransactionId?: string | null,
  ): Promise<void> {
    this.logger.error(
      `Subscription verification mismatch txRef=${payment.transactionReference} paymentId=${payment.id}: ${reason}`,
    );

    await this.prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: {
        failureReason: reason,
        ...(providerTransactionId ? { providerTransactionId } : {}),
      },
    });

    if (payment.failureReason === reason) {
      return;
    }

    this.auditPayment(
      payment,
      SUBSCRIPTION_PAYMENT_AUDIT_ACTIONS.VERIFICATION_MISMATCH,
      {
        failureReason: reason,
        previousStatus: payment.status,
        status: payment.status,
      },
    );
  }

  private async recordTerminalFailure(
    payment: SettlementPayment,
    verified: VerifiedPayment,
  ): Promise<SubscriptionSettlementResult> {
    const status =
      verified.status === 'cancelled'
        ? PaymentTransactionStatus.CANCELLED
        : PaymentTransactionStatus.FAILED;
    const outcome = verified.status === 'cancelled' ? 'cancelled' : 'failed';

    if (payment.status !== status) {
      await this.prisma.paymentTransaction.updateMany({
        where: {
          id: payment.id,
          status: { not: PaymentTransactionStatus.SUCCESS },
        },
        data: {
          status,
          failedAt: timestampToSeconds(new Date()),
          providerTransactionId: verified.providerTransactionId ?? undefined,
        },
      });

      this.auditPayment(
        payment,
        outcome === 'cancelled'
          ? SUBSCRIPTION_PAYMENT_AUDIT_ACTIONS.CANCELLED
          : SUBSCRIPTION_PAYMENT_AUDIT_ACTIONS.FAILED,
        {
          previousStatus: payment.status,
          status,
          providerStatus: verified.status,
        },
      );
    }

    return {
      outcome,
      transactionReference: payment.transactionReference,
      paymentTransactionId: payment.id,
    };
  }

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

  private auditPayment(
    payment: SettlementPayment,
    action: string,
    payload: Record<string, unknown>,
  ): void {
    this.auditEmitter.emit({
      userId: payment.initiatedById ?? undefined,
      userEmail: payment.initiatedBy?.email ?? undefined,
      tenantId: payment.tenantId,
      module: 'SUBSCRIPTIONS',
      action,
      targetType: 'PaymentTransaction',
      targetId: payment.id,
      payload: {
        source: ONLINE_PAYMENT_AUDIT_SOURCE,
        transactionReference: payment.transactionReference,
        initiatedByUserId: payment.initiatedById,
        planId: payment.planId,
        amount: formatPaymentAmount(payment.amount),
        currency: payment.currency,
        ...payload,
      },
    });
  }
}

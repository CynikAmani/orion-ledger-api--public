import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { DiscountType } from '@prisma/client';
import type { AuditContext } from '../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  ONLINE_PAYMENT_CURRENCY,
  PAYMENT_PROVIDER_CLIENT,
} from '../../online-payments/constants/online-payment.constant';
import { PaymentProviderRequestError } from '../../online-payments/errors/payment-provider.error';
import type { PaymentProviderClient } from '../../online-payments/interfaces/payment-provider-client.interface';
import { createTransactionReference } from '../../online-payments/utils/transaction-reference.util';
import { OnlineRepaymentsService } from '../../system-configurations/platform/online-repayments/services/online-repayments.service';
import { SUBSCRIPTION_PAYMENT_AUDIT_ACTIONS } from '../constants/subscription-payment-audit-actions.constant';
import { formatPaymentAmount } from '../utils/payment-amount.util';
import {
  calculateDiscountedPrice,
  resolveCheckoutDiscount,
} from '../utils/subscription-plan-discount.util';
import { buildSubscriptionPaymentProviderUrls } from '../utils/subscription-payment-return-url.util';

export interface InitiateSubscriptionPaymentInput {
  tenantId: string;
  initiatedById: number;
  initiatedByEmail?: string;
  initiatedByFullname: string;
  planId: number;
  discountCode?: string;
  frontendOrigin: string;
  audit: AuditContext;
}

export interface AppliedCheckoutDiscountResponse {
  discountType: DiscountType;
  value: number;
  /** Set when the customer redeemed a coupon. Null for a public schedule discount. */
  code: string | null;
}

export interface InitiateSubscriptionPaymentResponse {
  transactionReference: string;
  checkoutUrl: string;
  status: 'PENDING';
  planId: number;
  basePrice: string;
  amount: string;
  currency: string;
  discount: AppliedCheckoutDiscountResponse | null;
}

@Injectable()
export class SubscriptionPaymentInitiationService {
  private readonly logger = new Logger(
    SubscriptionPaymentInitiationService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
    private readonly onlineRepayments: OnlineRepaymentsService,
    @Inject(PAYMENT_PROVIDER_CLIENT)
    private readonly paymentProviderClient: PaymentProviderClient,
  ) {}

  async initiate(
    input: InitiateSubscriptionPaymentInput,
  ): Promise<InitiateSubscriptionPaymentResponse> {
    if (!(await this.onlineRepayments.isOnlineRepaymentsEnabled())) {
      throw new ServiceUnavailableException(
        'Online payments are temporarily unavailable. Use manual payment instead.',
      );
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { tenantId: input.tenantId },
      select: { tenantId: true, isActive: true, deletedAt: true },
    });

    if (!tenant || !tenant.isActive || tenant.deletedAt) {
      throw new ForbiddenException(
        'This institution cannot start a subscription payment',
      );
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: input.planId },
      select: {
        id: true,
        name: true,
        price: true,
        durationInDays: true,
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

    if (
      !plan.isActive ||
      plan.price.lessThanOrEqualTo(0) ||
      plan.durationInDays < 1
    ) {
      throw new BadRequestException('This plan is not available for payment');
    }

    const checkoutDiscount = resolveCheckoutDiscount(
      new Date(),
      plan.discounts,
      input.discountCode,
    );
    if (checkoutDiscount.codeRejected) {
      throw new BadRequestException('Discount code is not valid');
    }

    const activeDiscount = checkoutDiscount.discount;

    const charged = calculateDiscountedPrice(plan.price, activeDiscount);
    if (charged.lessThanOrEqualTo(0)) {
      throw new BadRequestException('This plan is not available for payment');
    }

    const transactionReference = createTransactionReference();
    const amount = formatPaymentAmount(charged);
    const basePrice = formatPaymentAmount(plan.price);
    const pricing = {
      basePrice,
      amount,
      ...(activeDiscount
        ? {
            discountId: activeDiscount.id,
            discountType: activeDiscount.discountType,
            discountValue: activeDiscount.value,
            discountCode: activeDiscount.code,
          }
        : {}),
    };
    const discount = activeDiscount
      ? {
          discountType: activeDiscount.discountType,
          value: activeDiscount.value,
          code: activeDiscount.code,
        }
      : null;
    const { callbackUrl, returnUrl } = buildSubscriptionPaymentProviderUrls(
      input.frontendOrigin,
      transactionReference,
    );
    const customerName = splitCustomerName(input.initiatedByFullname);

    const payment = await this.prisma.paymentTransaction.create({
      data: {
        transactionReference,
        tenantId: input.tenantId,
        planId: plan.id,
        durationInDays: plan.durationInDays,
        initiatedById: input.initiatedById,
        amount: charged,
        currency: ONLINE_PAYMENT_CURRENCY,
        metadata: { planName: plan.name, ...pricing },
      },
      select: { id: true, transactionReference: true },
    });

    try {
      const checkout = await this.paymentProviderClient.initializeCheckout({
        transactionReference,
        amount,
        currency: ONLINE_PAYMENT_CURRENCY,
        callbackUrl,
        returnUrl,
        customer: {
          email: input.initiatedByEmail,
          firstName: customerName.firstName,
          lastName: customerName.lastName,
        },
        description: plan.name,
      });

      await this.prisma.$transaction([
        this.prisma.paymentTransaction.update({
          where: { id: payment.id },
          data: {
            checkoutUrl: checkout.checkoutUrl,
            metadata: {
              planName: plan.name,
              providerMode: checkout.mode,
              ...pricing,
            },
            ...(checkout.providerTransactionId
              ? { providerTransactionId: checkout.providerTransactionId }
              : {}),
          },
        }),
        this.prisma.tenant.update({
          where: { tenantId: input.tenantId },
          data: { currentPlanId: plan.id },
        }),
      ]);

      this.auditEmitter.emit({
        ...input.audit,
        tenantId: input.tenantId,
        module: 'SUBSCRIPTIONS',
        action: SUBSCRIPTION_PAYMENT_AUDIT_ACTIONS.INITIATED,
        targetType: 'PaymentTransaction',
        targetId: payment.id,
        payload: {
          transactionReference,
          planId: plan.id,
          planName: plan.name,
          amount,
          basePrice,
          currency: ONLINE_PAYMENT_CURRENCY,
          durationInDays: plan.durationInDays,
          ...(activeDiscount
            ? {
                discountId: activeDiscount.id,
                discountType: activeDiscount.discountType,
                discountValue: activeDiscount.value,
              }
            : {}),
          providerMode: checkout.mode,
          status: 'PENDING',
        },
      });

      this.logger.log(
        `Subscription checkout started txRef=${transactionReference} tenantId=${input.tenantId} planId=${plan.id} initiatedBy=${input.initiatedById}`,
      );

      return {
        transactionReference,
        checkoutUrl: checkout.checkoutUrl,
        status: 'PENDING',
        planId: plan.id,
        basePrice,
        amount,
        currency: ONLINE_PAYMENT_CURRENCY,
        discount,
      };
    } catch (error) {
      const message =
        error instanceof PaymentProviderRequestError
          ? error.message
          : 'Payment provider checkout failed';

      await this.prisma.paymentTransaction.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failureReason: message,
          failedAt: new Date(),
        },
      });

      this.auditEmitter.emit({
        ...input.audit,
        tenantId: input.tenantId,
        module: 'SUBSCRIPTIONS',
        action: SUBSCRIPTION_PAYMENT_AUDIT_ACTIONS.CHECKOUT_FAILED,
        targetType: 'PaymentTransaction',
        targetId: payment.id,
        payload: {
          transactionReference,
          planId: plan.id,
          planName: plan.name,
          amount,
          currency: ONLINE_PAYMENT_CURRENCY,
          previousStatus: 'PENDING',
          status: 'FAILED',
          failureReason: message,
        },
      });

      this.logger.error(
        `Subscription checkout failed txRef=${transactionReference} initiatedBy=${input.initiatedById}: ${message}`,
      );

      throw new ServiceUnavailableException(
        'Payment checkout could not be started. Please try again.',
      );
    }
  }

  async getForTenant(
    tenantId: string,
    transactionReference: string,
  ): Promise<SubscriptionPaymentStatusResponse> {
    if (
      transactionReference.length === 0 ||
      transactionReference.length > 100
    ) {
      throw new NotFoundException('Payment transaction was not found');
    }

    const payment = await this.prisma.paymentTransaction.findFirst({
      where: { transactionReference, tenantId },
      select: {
        transactionReference: true,
        planId: true,
        amount: true,
        currency: true,
        status: true,
        subscription: { select: { id: true } },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment transaction was not found');
    }

    return {
      transactionReference: payment.transactionReference,
      planId: payment.planId,
      amount: formatPaymentAmount(payment.amount),
      currency: payment.currency,
      status: payment.status,
      subscriptionId: payment.subscription?.id ?? null,
    };
  }
}

export interface SubscriptionPaymentStatusResponse {
  transactionReference: string;
  planId: number;
  amount: string;
  currency: string;
  status: string;
  subscriptionId: string | null;
}

function splitCustomerName(fullname: string): {
  firstName: string;
  lastName?: string;
} {
  const parts = fullname.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: 'Customer' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ') || undefined,
  };
}

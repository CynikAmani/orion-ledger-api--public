import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PaymentTransactionStatus } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { PAYMENT_PROVIDER_CLIENT } from '../../online-payments/constants/online-payment.constant';
import { PaymentProviderRequestError } from '../../online-payments/errors/payment-provider.error';
import type { PaymentProviderClient } from '../../online-payments/interfaces/payment-provider-client.interface';
import type { OnlinePaymentApplyOutcome } from '../../online-payments/settlement/online-payment-settlement';
import { formatPaymentAmount } from '../utils/payment-amount.util';
import { SubscriptionPaymentSettlementService } from './subscription-payment-settlement.service';

export type SubscriptionPaymentPollOutcome = Exclude<
  OnlinePaymentApplyOutcome,
  'not_found'
>;

export interface SubscriptionPaymentVerificationResponse {
  transactionReference: string;
  planId: number;
  amount: string;
  currency: string;
  status: PaymentTransactionStatus;
  subscriptionId: string | null;
  outcome: SubscriptionPaymentPollOutcome;
  failureReason: string | null;
}

@Injectable()
export class SubscriptionPaymentVerificationService {
  private readonly logger = new Logger(
    SubscriptionPaymentVerificationService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly settlement: SubscriptionPaymentSettlementService,
    @Inject(PAYMENT_PROVIDER_CLIENT)
    private readonly paymentProviderClient: PaymentProviderClient,
  ) {}

  async verifyForTenant(
    tenantId: string,
    transactionReference: string,
  ): Promise<SubscriptionPaymentVerificationResponse> {
    const payment = await this.load(tenantId, transactionReference);

    if (payment.status === PaymentTransactionStatus.SUCCESS) {
      return this.toResponse(payment, 'already_settled');
    }

    if (!payment.checkoutUrl && this.isTerminal(payment.status)) {
      return this.toResponse(
        payment,
        this.outcomeForStoredStatus(payment.status),
      );
    }

    try {
      const verified =
        await this.paymentProviderClient.verifyTransaction(
          transactionReference,
        );
      const applied = await this.settlement.applyVerifiedPayment(verified);

      if (applied.outcome === 'not_found') {
        this.logger.error(
          `Verified subscription payment could not be matched txRef=${transactionReference} tenantId=${tenantId}`,
        );
        throw new ServiceUnavailableException(
          'Payment could not be matched after verification',
        );
      }

      const refreshed = await this.load(tenantId, transactionReference);
      return this.toResponse(refreshed, applied.outcome);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      if (
        error instanceof PaymentProviderRequestError &&
        error.statusCode === 400
      ) {
        this.logger.warn(
          `PayChangu has no payment for txRef=${transactionReference}: ${error.message}`,
        );
        const closed = await this.settlement.recordCheckoutWithoutPayment(
          transactionReference,
          'PayChangu has no payment for this checkout',
        );
        if (closed.outcome === 'not_found') {
          throw new NotFoundException('Payment transaction was not found');
        }
        const refreshed = await this.load(tenantId, transactionReference);
        return this.toResponse(refreshed, closed.outcome);
      }

      const message =
        error instanceof PaymentProviderRequestError
          ? error.message
          : 'Payment provider verification failed';
      this.logger.error(
        `Subscription payment verification unavailable txRef=${transactionReference}: ${message}`,
      );
      throw new ServiceUnavailableException(
        'Payment provider verification is unavailable',
      );
    }
  }

  private async load(tenantId: string, transactionReference: string) {
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
        checkoutUrl: true,
        failureReason: true,
        subscription: { select: { id: true } },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment transaction was not found');
    }

    return payment;
  }

  private toResponse(
    payment: {
      transactionReference: string;
      planId: number;
      amount: Parameters<typeof formatPaymentAmount>[0];
      currency: string;
      status: PaymentTransactionStatus;
      failureReason: string | null;
      subscription: { id: string } | null;
    },
    outcome: SubscriptionPaymentPollOutcome,
  ): SubscriptionPaymentVerificationResponse {
    return {
      transactionReference: payment.transactionReference,
      planId: payment.planId,
      amount: formatPaymentAmount(payment.amount),
      currency: payment.currency,
      status: payment.status,
      subscriptionId: payment.subscription?.id ?? null,
      outcome,
      failureReason: payment.failureReason,
    };
  }

  private isTerminal(status: PaymentTransactionStatus): boolean {
    return (
      status === PaymentTransactionStatus.FAILED ||
      status === PaymentTransactionStatus.CANCELLED ||
      status === PaymentTransactionStatus.EXPIRED
    );
  }

  private outcomeForStoredStatus(
    status: PaymentTransactionStatus,
  ): SubscriptionPaymentPollOutcome {
    if (status === PaymentTransactionStatus.CANCELLED) {
      return 'cancelled';
    }

    if (
      status === PaymentTransactionStatus.FAILED ||
      status === PaymentTransactionStatus.EXPIRED
    ) {
      return 'failed';
    }

    return 'pending';
  }
}

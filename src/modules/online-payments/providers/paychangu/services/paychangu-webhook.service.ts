import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PAYMENT_PROVIDER_CLIENT } from '../../../constants/online-payment.constant';
import { PaymentProviderRequestError } from '../../../errors/payment-provider.error';
import type {
  PaymentProviderClient,
  VerifiedPayment,
} from '../../../interfaces/payment-provider-client.interface';
import {
  ONLINE_PAYMENT_SETTLEMENT,
  type OnlinePaymentSettlement,
} from '../../../settlement/online-payment-settlement';
import { PaychanguConfigService } from './paychangu-config.service';
import { verifyPaychanguSignature } from '../utils/paychangu-signature.util';
import {
  isPaychanguPaymentEvent,
  mapPaychanguWebhookPayload,
  parsePaychanguWebhookPayload,
  shouldIgnorePaychanguEvent,
} from '../utils/paychangu-webhook-payload.util';

@Injectable()
export class PaychanguWebhookService {
  private readonly logger = new Logger(PaychanguWebhookService.name);

  constructor(
    private readonly paychanguConfig: PaychanguConfigService,
    @Inject(PAYMENT_PROVIDER_CLIENT)
    private readonly paymentProvider: PaymentProviderClient,
    @Inject(ONLINE_PAYMENT_SETTLEMENT)
    private readonly settlement: OnlinePaymentSettlement,
  ) {}

  async handleRawWebhook(
    rawBody: Buffer | undefined,
    signatureHeader: string | string[] | undefined,
  ): Promise<{ received: true }> {
    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException('Webhook raw body is required');
    }

    const signature = Array.isArray(signatureHeader)
      ? signatureHeader[0]
      : signatureHeader;

    if (!signature) {
      throw new BadRequestException('Missing Signature header');
    }

    const { webhookSecret, mode } = this.paychanguConfig.getActiveConfig();
    if (!webhookSecret) {
      throw new ServiceUnavailableException(
        'PayChangu webhook secret is not configured for the active mode',
      );
    }

    const authentic = verifyPaychanguSignature({
      rawBody,
      signatureHeader: signature,
      webhookSecret,
    });

    if (!authentic) {
      this.logger.warn(
        `Rejected PayChangu webhook with invalid signature mode=${mode}`,
      );
      throw new ForbiddenException('Invalid webhook signature');
    }

    let payload: Record<string, unknown>;
    try {
      payload = parsePaychanguWebhookPayload(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Webhook payload is not valid JSON');
    }

    const mapped = mapPaychanguWebhookPayload(payload);
    this.logger.log(
      `PayChangu webhook accepted eventType=${mapped.eventType ?? 'unknown'} txRef=${mapped.transactionReference ?? 'none'} mode=${mapped.mode ?? mode}`,
    );

    if (
      shouldIgnorePaychanguEvent(mapped.eventType) ||
      !isPaychanguPaymentEvent(mapped.eventType)
    ) {
      this.logger.log(
        `Ignoring PayChangu webhook eventType=${mapped.eventType ?? 'unknown'}`,
      );
      return { received: true };
    }

    if (!mapped.transactionReference) {
      this.logger.warn(
        `PayChangu webhook is missing tx_ref providerRef=${mapped.providerTransactionId ?? 'none'}`,
      );
      return { received: true };
    }

    let verified: VerifiedPayment;
    try {
      verified = await this.paymentProvider.verifyTransaction(
        mapped.transactionReference,
      );
    } catch (error) {
      const message =
        error instanceof PaymentProviderRequestError
          ? error.message
          : 'Payment provider verification failed';
      this.logger.error(
        `PayChangu verification unavailable txRef=${mapped.transactionReference}: ${message}`,
      );
      throw new ServiceUnavailableException(
        'Payment provider verification is unavailable',
      );
    }

    const applied = await this.settlement.applyVerifiedPayment(verified);

    this.logger.log(
      `PayChangu webhook applied txRef=${mapped.transactionReference} outcome=${applied.outcome}`,
    );

    if (applied.outcome === 'not_found' || applied.outcome === 'pending') {
      throw new ServiceUnavailableException(
        applied.outcome === 'not_found'
          ? 'Payment transaction is not available for settlement yet'
          : 'Payment is still pending provider confirmation',
      );
    }

    return { received: true };
  }
}

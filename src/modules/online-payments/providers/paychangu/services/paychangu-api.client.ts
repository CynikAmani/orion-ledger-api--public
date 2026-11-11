import { Injectable, Logger } from '@nestjs/common';
import { PaymentProviderRequestError } from '../../../errors/payment-provider.error';
import type {
  InitializeCheckoutInput,
  InitializedCheckout,
  PaymentProviderClient,
  VerifiedPayment,
  VerifiedPaymentStatus,
} from '../../../interfaces/payment-provider-client.interface';
import {
  PAYCHANGU_PAYMENT_PATH,
  PAYCHANGU_REQUEST_TIMEOUT_MS,
  PAYCHANGU_VERIFY_PATH,
} from '../constants/paychangu.constant';
import {
  isRecord,
  nestedRecord,
  readNumber,
  readString,
} from '../utils/paychangu-json.util';
import { PaychanguConfigService } from './paychangu-config.service';

@Injectable()
export class PaychanguApiClient implements PaymentProviderClient {
  private readonly logger = new Logger(PaychanguApiClient.name);

  constructor(private readonly paychanguConfig: PaychanguConfigService) {}

  async initializeCheckout(
    input: InitializeCheckoutInput,
  ): Promise<InitializedCheckout> {
    const config = this.requireSecretKey();
    const body = await this.providerJson({
      method: 'POST',
      url: `${config.baseUrl}${PAYCHANGU_PAYMENT_PATH}`,
      secretKey: config.secretKey,
      payload: {
        amount: input.amount,
        currency: input.currency,
        tx_ref: input.transactionReference,
        callback_url: input.callbackUrl,
        return_url: input.returnUrl,
        ...(input.customer.email ? { email: input.customer.email } : {}),
        ...(input.customer.firstName
          ? { first_name: input.customer.firstName }
          : {}),
        ...(input.customer.lastName
          ? { last_name: input.customer.lastName }
          : {}),
        customization: {
          title: 'Subscription',
          description: input.description ?? 'Platform subscription',
        },
      },
      action: 'checkout',
      transactionReference: input.transactionReference,
    });

    const envelopeStatus = readString(body, 'status')?.toLowerCase();
    if (envelopeStatus !== 'success') {
      throw new PaymentProviderRequestError(
        `PayChangu checkout was not successful for ${input.transactionReference}`,
      );
    }

    const data = nestedRecord(body, 'data');
    const checkoutUrl =
      (data ? readString(data, 'checkout_url') : null) ??
      readString(body, 'checkout_url');

    if (!checkoutUrl) {
      throw new PaymentProviderRequestError(
        `PayChangu checkout response is missing checkout_url for ${input.transactionReference}`,
      );
    }

    this.logger.log(
      `PayChangu checkout created txRef=${input.transactionReference} mode=${config.mode}`,
    );

    return {
      transactionReference: input.transactionReference,
      checkoutUrl,
      providerTransactionId: this.readProviderReference(
        data,
        input.transactionReference,
      ),
      mode: config.mode,
    };
  }

  async verifyTransaction(
    transactionReference: string,
  ): Promise<VerifiedPayment> {
    const config = this.requireSecretKey();
    const body = await this.providerJson({
      method: 'GET',
      url: `${config.baseUrl}${PAYCHANGU_VERIFY_PATH}/${encodeURIComponent(transactionReference)}`,
      secretKey: config.secretKey,
      action: 'verification',
      transactionReference,
    });

    const envelopeStatus = readString(body, 'status')?.toLowerCase();
    if (envelopeStatus !== 'success') {
      throw new PaymentProviderRequestError(
        `PayChangu verification lookup was not successful for ${transactionReference}`,
      );
    }

    const data = body.data;
    if (!isRecord(data)) {
      throw new PaymentProviderRequestError(
        `PayChangu verification payload is missing data for ${transactionReference}`,
      );
    }

    const verifiedReference = readString(data, 'tx_ref');
    const amount = readNumber(data, 'amount');
    const currency = readString(data, 'currency');
    const paymentStatus = readString(data, 'status');

    if (!verifiedReference || amount === null || !currency || !paymentStatus) {
      throw new PaymentProviderRequestError(
        `PayChangu verification payload is missing tx_ref, amount, currency, or status for ${transactionReference}`,
      );
    }

    this.logger.log(
      `PayChangu verification txRef=${verifiedReference} status=${paymentStatus} amount=${amount} currency=${currency} mode=${config.mode}`,
    );

    return {
      transactionReference: verifiedReference,
      providerTransactionId: readString(data, 'reference'),
      status: this.mapStatus(paymentStatus),
      amount,
      currency: currency.toUpperCase(),
    };
  }

  private readProviderReference(
    data: Record<string, unknown> | null,
    transactionReference: string,
  ): string | null {
    const nested = data ? nestedRecord(data, 'data') : null;
    const echoedReference =
      (data ? readString(data, 'tx_ref') : null) ??
      (nested ? readString(nested, 'tx_ref') : null);

    if (!echoedReference || echoedReference === transactionReference) {
      return null;
    }

    return echoedReference;
  }

  private requireSecretKey(): ReturnType<
    PaychanguConfigService['getActiveConfig']
  > {
    const config = this.paychanguConfig.getActiveConfig();
    if (!config.secretKey) {
      throw new PaymentProviderRequestError(
        'PayChangu secret key is not configured for the active mode',
      );
    }

    return config;
  }

  private async providerJson(params: {
    method: 'GET' | 'POST';
    url: string;
    secretKey: string;
    payload?: Record<string, unknown>;
    action: 'checkout' | 'verification';
    transactionReference: string;
  }): Promise<Record<string, unknown>> {
    let response: Response;

    try {
      response = await fetch(params.url, {
        method: params.method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${params.secretKey}`,
          ...(params.payload ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(params.payload ? { body: JSON.stringify(params.payload) } : {}),
        signal: AbortSignal.timeout(PAYCHANGU_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new PaymentProviderRequestError(
        `PayChangu ${params.action} request failed for ${params.transactionReference}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      const detail = readPaychanguErrorDetail(body);
      throw new PaymentProviderRequestError(
        `PayChangu ${params.action} HTTP ${response.status} for ${params.transactionReference}${detail ? `: ${detail}` : ''}`,
        response.status,
      );
    }

    if (body === null) {
      throw new PaymentProviderRequestError(
        `PayChangu ${params.action} returned a non-JSON response for ${params.transactionReference}`,
        response.status,
      );
    }

    if (!isRecord(body)) {
      throw new PaymentProviderRequestError(
        `PayChangu ${params.action} returned an unexpected payload for ${params.transactionReference}`,
      );
    }

    return body;
  }

  private mapStatus(status: string): VerifiedPaymentStatus {
    const normalized = status.trim().toLowerCase();
    if (normalized === 'success' || normalized === 'successful') {
      return 'success';
    }
    if (
      normalized === 'failed' ||
      normalized === 'fail' ||
      normalized === 'failure'
    ) {
      return 'failed';
    }
    if (normalized === 'cancelled' || normalized === 'canceled') {
      return 'cancelled';
    }
    return 'pending';
  }
}

function readPaychanguErrorDetail(body: unknown): string | null {
  if (!isRecord(body)) {
    return null;
  }

  const message = body.message;
  if (typeof message === 'string' && message.trim().length > 0) {
    return message.trim().slice(0, 240);
  }

  if (isRecord(message)) {
    const text = JSON.stringify(message);
    return text.length > 0 ? text.slice(0, 240) : null;
  }

  const status = readString(body, 'status');
  return status ? status.slice(0, 240) : null;
}

export class PaymentProviderRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'PaymentProviderRequestError';
  }
}

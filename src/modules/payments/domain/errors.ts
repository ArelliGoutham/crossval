export type PaymentErrorCode =
  | 'order_not_found'
  | 'overpayment'
  | 'idempotency_key_reused'
  | 'validation_failed';

export class PaymentError extends Error {
  readonly code: PaymentErrorCode;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: PaymentErrorCode,
    message?: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message ?? code);
    this.code = code;
    this.name = 'PaymentError';
    this.details = details;
  }
}

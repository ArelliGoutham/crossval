export type OrderErrorCode =
  | 'not_found'
  | 'payment_locked'
  | 'validation_failed';

export class OrderError extends Error {
  readonly code: OrderErrorCode;

  constructor(code: OrderErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'OrderError';
  }
}

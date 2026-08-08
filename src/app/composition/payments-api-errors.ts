import {
  PaymentError,
  type PaymentErrorCode,
} from '@/modules/payments/public';
import { errorResponse } from '@/shared/http/api-response';
import { mapApiErrorResponse } from '@/app/composition/api-errors';
import type { NextResponse } from 'next/server';

const paymentErrorStatus: Record<PaymentErrorCode, number> = {
  order_not_found: 404,
  overpayment: 422,
  idempotency_key_reused: 409,
  validation_failed: 400,
};

const paymentErrorCode: Record<PaymentErrorCode, string> = {
  order_not_found: 'NOT_FOUND',
  overpayment: 'OVERPAYMENT',
  idempotency_key_reused: 'IDEMPOTENCY_KEY_REUSED',
  validation_failed: 'VALIDATION_ERROR',
};

const paymentErrorMessage: Record<PaymentErrorCode, string> = {
  order_not_found: 'The requested order was not found.',
  overpayment: 'Payment exceeds the remaining balance.',
  idempotency_key_reused:
    'This idempotency key was already used with a different request.',
  validation_failed: 'The request contained invalid data.',
};

export function mapPaymentsApiErrorResponse(
  error: unknown,
  requestId: string,
): NextResponse {
  if (error instanceof PaymentError) {
    return errorResponse({
      status: paymentErrorStatus[error.code],
      requestId,
      code: paymentErrorCode[error.code],
      message: paymentErrorMessage[error.code],
      details: error.details,
    });
  }

  return mapApiErrorResponse(error, requestId);
}

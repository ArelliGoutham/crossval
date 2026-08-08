import { OrderError, type OrderErrorCode } from '@/modules/orders/public';
import { errorResponse } from '@/shared/http/api-response';
import { mapApiErrorResponse } from '@/app/composition/api-errors';
import type { NextResponse } from 'next/server';

const orderErrorStatus: Record<OrderErrorCode, number> = {
  not_found: 404,
  payment_locked: 409,
  validation_failed: 400,
};

const orderErrorCode: Record<OrderErrorCode, string> = {
  not_found: 'NOT_FOUND',
  payment_locked: 'PAYMENT_LOCKED',
  validation_failed: 'VALIDATION_ERROR',
};

const orderErrorMessage: Record<OrderErrorCode, string> = {
  not_found: 'The requested order was not found.',
  payment_locked:
    'This order has payments recorded and cannot be modified or deleted.',
  validation_failed: 'The request contained invalid data.',
};

export function mapOrdersApiErrorResponse(
  error: unknown,
  requestId: string,
): NextResponse {
  if (error instanceof OrderError) {
    return errorResponse({
      status: orderErrorStatus[error.code],
      requestId,
      code: orderErrorCode[error.code],
      message: orderErrorMessage[error.code],
    });
  }

  return mapApiErrorResponse(error, requestId);
}

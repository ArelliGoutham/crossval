import {
  IdentityError,
  type IdentityErrorCode,
} from '@/modules/identity/public';
import { errorResponse, mapErrorResponse } from '@/shared/http/api-response';
import type { NextResponse } from 'next/server';

const identityErrorStatus: Record<IdentityErrorCode, number> = {
  duplicate_email: 409,
  invalid_credentials: 401,
  unauthorized: 401,
};

const identityErrorCode: Record<IdentityErrorCode, string> = {
  duplicate_email: 'DUPLICATE_EMAIL',
  invalid_credentials: 'INVALID_CREDENTIALS',
  unauthorized: 'UNAUTHORIZED',
};

const identityErrorMessage: Record<IdentityErrorCode, string> = {
  duplicate_email: 'An account already exists for that email address.',
  invalid_credentials: 'Invalid email or password.',
  unauthorized: 'Authentication is required.',
};

export function mapApiErrorResponse(
  error: unknown,
  requestId: string,
): NextResponse {
  if (error instanceof IdentityError) {
    return mapIdentityError(error.code, requestId);
  }

  return mapErrorResponse(error, requestId);
}

function mapIdentityError(
  code: IdentityErrorCode,
  requestId: string,
): NextResponse {
  return errorResponse({
    status: identityErrorStatus[code],
    requestId,
    code: identityErrorCode[code],
    message: identityErrorMessage[code],
  });
}

import { ZodError } from 'zod';
import { NextResponse } from 'next/server';

import {
  IdentityError,
  type IdentityErrorCode,
} from '@/modules/identity/public';

type ApiErrorCode =
  | 'DUPLICATE_EMAIL'
  | 'INTERNAL_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_JSON'
  | 'INVALID_ORIGIN'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR';

type ApiErrorDetails = Record<string, unknown> | undefined;

export function dataResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function errorResponse(input: {
  status: number;
  requestId: string;
  code: ApiErrorCode;
  message: string;
  details?: ApiErrorDetails;
}): NextResponse {
  const body = input.details
    ? {
        error: {
          code: input.code,
          message: input.message,
          details: input.details,
        },
        requestId: input.requestId,
      }
    : {
        error: {
          code: input.code,
          message: input.message,
        },
        requestId: input.requestId,
      };

  return NextResponse.json(body, { status: input.status });
}

export function mapErrorResponse(
  error: unknown,
  requestId: string,
): NextResponse {
  if (error instanceof ZodError) {
    return errorResponse({
      status: 400,
      requestId,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      details: {
        issues: error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
          code: issue.code,
        })),
      },
    });
  }

  if (error instanceof InvalidJsonError) {
    return errorResponse({
      status: 400,
      requestId,
      code: 'INVALID_JSON',
      message: 'Request body must be valid JSON.',
    });
  }

  if (error instanceof InvalidOriginError) {
    return errorResponse({
      status: 400,
      requestId,
      code: 'INVALID_ORIGIN',
      message: 'Request origin is not allowed.',
    });
  }

  if (error instanceof IdentityError) {
    return mapIdentityError(error.code, requestId);
  }

  console.error('Unhandled API error', { requestId, error });

  return errorResponse({
    status: 500,
    requestId,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred.',
  });
}

export class InvalidJsonError extends Error {
  constructor() {
    super('invalid_json');
    this.name = 'InvalidJsonError';
  }
}

export class InvalidOriginError extends Error {
  constructor() {
    super('invalid_origin');
    this.name = 'InvalidOriginError';
  }
}

function mapIdentityError(
  code: IdentityErrorCode,
  requestId: string,
): NextResponse {
  switch (code) {
    case 'duplicate_email':
      return errorResponse({
        status: 409,
        requestId,
        code: 'DUPLICATE_EMAIL',
        message: 'An account already exists for that email address.',
      });
    case 'invalid_credentials':
      return errorResponse({
        status: 401,
        requestId,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    case 'unauthorized':
      return errorResponse({
        status: 401,
        requestId,
        code: 'UNAUTHORIZED',
        message: 'Authentication is required.',
      });
  }
}

import { ZodError } from 'zod';
import { NextResponse } from 'next/server';

export type ApiErrorDetails = Record<string, unknown> | undefined;

export function dataResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function errorResponse(input: {
  status: number;
  requestId: string;
  code: string;
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

  console.error('Unhandled API error', {
    requestId,
    errorName: error instanceof Error ? error.name : typeof error,
  });

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

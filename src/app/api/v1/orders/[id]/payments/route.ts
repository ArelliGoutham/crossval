import { type NextRequest, NextResponse } from 'next/server';

import { composeIdentityService } from '@/modules/identity/public';
import {
  composePaymentsService,
  idempotencyKeySchema,
  recordPaymentInputSchema,
} from '@/modules/payments/public';
import { dataResponse, InvalidJsonError } from '@/shared/http/api-response';
import { mapPaymentsApiErrorResponse } from '@/app/composition/payments-api-errors';
import { createRequestContext } from '@/shared/http/request-context';
import { loadEnvironment } from '@/shared/config/environment';
import { assertSameOrigin } from '@/shared/http/same-origin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const context = createRequestContext(request);
  const { id } = await params;

  try {
    const identityService = await composeIdentityService();
    const merchant = await identityService.requireMerchant(
      context.sessionToken ?? '',
    );

    const paymentsService = await composePaymentsService();
    const payments = await paymentsService.listPayments(merchant, id);

    return dataResponse({ payments });
  } catch (error: unknown) {
    return mapPaymentsApiErrorResponse(error, context.requestId);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const context = createRequestContext(request);
  const { id } = await params;

  try {
    const environment = loadEnvironment(process.env);
    assertSameOrigin(request, environment.appOrigin);

    const identityService = await composeIdentityService();
    const merchant = await identityService.requireMerchant(
      context.sessionToken ?? '',
    );

    const idempotencyKey = idempotencyKeySchema.parse(
      request.headers.get('idempotency-key'),
    );
    const input = recordPaymentInputSchema.parse(await readJson(request));

    const paymentsService = await composePaymentsService();
    const outcome = await paymentsService.recordPayment(
      merchant,
      id,
      input,
      idempotencyKey,
    );

    return dataResponse({ payment: outcome.result }, outcome.httpStatus);
  } catch (error: unknown) {
    return mapPaymentsApiErrorResponse(error, context.requestId);
  }
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new InvalidJsonError();
  }
}

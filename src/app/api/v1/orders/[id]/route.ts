import { type NextRequest, NextResponse } from 'next/server';

import { composeIdentityService } from '@/modules/identity/public';
import { composeOrdersService } from '@/modules/orders/public';
import { updateOrderInputSchema } from '@/modules/orders/public';
import {
  dataResponse,
  InvalidJsonError,
  noContentResponse,
} from '@/shared/http/api-response';
import { mapOrdersApiErrorResponse } from '@/app/composition/orders-api-errors';
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

    const ordersService = await composeOrdersService();
    const order = await ordersService.getOrder(merchant, id);

    return dataResponse({ order });
  } catch (error: unknown) {
    return mapOrdersApiErrorResponse(error, context.requestId);
  }
}

export async function PATCH(
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

    const input = updateOrderInputSchema.parse(await readJson(request));

    const ordersService = await composeOrdersService();
    const order = await ordersService.updateOrder(merchant, id, input);

    return dataResponse({ order });
  } catch (error: unknown) {
    return mapOrdersApiErrorResponse(error, context.requestId);
  }
}

export async function DELETE(
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

    const ordersService = await composeOrdersService();
    await ordersService.deleteOrder(merchant, id);

    return noContentResponse();
  } catch (error: unknown) {
    return mapOrdersApiErrorResponse(error, context.requestId);
  }
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new InvalidJsonError();
  }
}

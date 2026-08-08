import { type NextRequest, NextResponse } from 'next/server';

import { composeIdentityService } from '@/modules/identity/public';
import { composeOrdersService } from '@/modules/orders/public';
import {
  createOrderInputSchema,
  listOrdersQuerySchema,
} from '@/modules/orders/public';
import { dataResponse, InvalidJsonError } from '@/shared/http/api-response';
import { mapOrdersApiErrorResponse } from '@/app/composition/orders-api-errors';
import { createRequestContext } from '@/shared/http/request-context';
import { loadEnvironment } from '@/shared/config/environment';
import { assertSameOrigin } from '@/shared/http/same-origin';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = createRequestContext(request);

  try {
    const identityService = await composeIdentityService();
    const merchant = await identityService.requireMerchant(
      context.sessionToken ?? '',
    );

    const query = listOrdersQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    const ordersService = await composeOrdersService();
    const orders = await ordersService.listOrders(merchant, query);

    return dataResponse({ orders });
  } catch (error: unknown) {
    return mapOrdersApiErrorResponse(error, context.requestId);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = createRequestContext(request);

  try {
    const environment = loadEnvironment(process.env);
    assertSameOrigin(request, environment.appOrigin);

    const identityService = await composeIdentityService();
    const merchant = await identityService.requireMerchant(
      context.sessionToken ?? '',
    );

    const input = createOrderInputSchema.parse(await readJson(request));

    const ordersService = await composeOrdersService();
    const order = await ordersService.createOrder(merchant, input);

    return dataResponse({ order }, 201);
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

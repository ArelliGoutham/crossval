import { type NextRequest, NextResponse } from 'next/server';

import {
  createIdentityModule,
} from '@/modules/identity/infrastructure/create-identity-module';
import { IdentityError } from '@/modules/identity/public';
import {
  dataResponse,
  mapErrorResponse,
} from '@/shared/http/api-response';
import { createRequestContext } from '@/shared/http/request-context';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = createRequestContext(request);

  try {
    if (context.sessionToken === null) {
      return mapErrorResponse(new IdentityError('unauthorized'), context.requestId);
    }

    const identityModule = await createIdentityModule();
    const identity = await identityModule.requireMerchant(context.sessionToken);

    return dataResponse({ identity });
  } catch (error: unknown) {
    return mapErrorResponse(error, context.requestId);
  }
}

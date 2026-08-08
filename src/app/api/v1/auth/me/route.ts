import { type NextRequest, NextResponse } from 'next/server';

import { composeIdentityService } from '@/modules/identity/public';
import { IdentityError } from '@/modules/identity/public';
import { dataResponse } from '@/shared/http/api-response';
import { mapApiErrorResponse } from '@/app/composition/api-errors';
import { createRequestContext } from '@/shared/http/request-context';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = createRequestContext(request);

  try {
    if (context.sessionToken === null) {
      return mapApiErrorResponse(
        new IdentityError('unauthorized'),
        context.requestId,
      );
    }

    const identityModule = await composeIdentityService();
    const identity = await identityModule.requireMerchant(context.sessionToken);

    return dataResponse({ identity });
  } catch (error: unknown) {
    return mapApiErrorResponse(error, context.requestId);
  }
}

import { type NextRequest, NextResponse } from 'next/server';

import { composeIdentityService } from '@/modules/identity/public';
import { noContentResponse } from '@/shared/http/api-response';
import { mapApiErrorResponse } from '@/app/composition/api-errors';
import { createRequestContext } from '@/shared/http/request-context';
import { loadEnvironment } from '@/shared/config/environment';
import { assertSameOrigin } from '@/shared/http/same-origin';
import { serializeClearedSessionCookie } from '@/shared/http/session-cookie';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = createRequestContext(request);

  try {
    const environment = loadEnvironment(process.env);
    assertSameOrigin(request, environment.appOrigin);

    if (context.sessionToken !== null) {
      const identityModule = await composeIdentityService();
      await identityModule.logout(context.sessionToken);
    }

    const response = noContentResponse();
    response.headers.set(
      'set-cookie',
      serializeClearedSessionCookie({ isProduction: environment.isProduction }),
    );

    return response;
  } catch (error: unknown) {
    return mapApiErrorResponse(error, context.requestId);
  }
}

import { type NextRequest, NextResponse } from 'next/server';

import {
  createIdentityModule,
} from '@/modules/identity/infrastructure/create-identity-module';
import {
  mapErrorResponse,
  noContentResponse,
} from '@/shared/http/api-response';
import {
  createRequestContext,
  SESSION_COOKIE_NAME,
} from '@/shared/http/request-context';
import { loadEnvironment } from '@/shared/config/environment';
import { assertSameOrigin } from '@/shared/http/same-origin';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = createRequestContext(request);

  try {
    const environment = loadEnvironment(process.env);
    assertSameOrigin(request, environment.appOrigin);

    if (context.sessionToken !== null) {
      const identityModule = await createIdentityModule();
      await identityModule.logout(context.sessionToken);
    }

    const response = noContentResponse();
    response.headers.set(
      'set-cookie',
      serializeClearedSessionCookie(environment.isProduction),
    );

    return response;
  } catch (error: unknown) {
    return mapErrorResponse(error, context.requestId);
  }
}

function serializeClearedSessionCookie(isProduction: boolean): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    `Expires=${new Date(0).toUTCString()}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (isProduction) {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}

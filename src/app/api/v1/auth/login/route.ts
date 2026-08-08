import { type NextRequest, NextResponse } from 'next/server';

import { composeIdentityService } from '@/modules/identity/public';
import { loginInputSchema } from '@/modules/identity/public';
import { dataResponse, InvalidJsonError } from '@/shared/http/api-response';
import { mapApiErrorResponse } from '@/app/composition/api-errors';
import { createRequestContext } from '@/shared/http/request-context';
import { loadEnvironment } from '@/shared/config/environment';
import { assertSameOrigin } from '@/shared/http/same-origin';
import { serializeSessionCookie } from '@/shared/http/session-cookie';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = createRequestContext(request);

  try {
    const environment = loadEnvironment(process.env);
    assertSameOrigin(request, environment.appOrigin);

    const credentials = loginInputSchema.parse(await readJson(request));
    const identityModule = await composeIdentityService();
    const result = await identityModule.login(credentials);
    const response = dataResponse(
      {
        user: {
          userId: result.identity.userId,
          merchantId: result.identity.merchantId,
          email: credentials.email,
        },
      },
      200,
    );

    setSessionCookie(response, result.session.token, result.session.expiresAt);

    return response;
  } catch (error: unknown) {
    return mapApiErrorResponse(error, context.requestId);
  }
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new InvalidJsonError();
  }
}

function setSessionCookie(
  response: NextResponse,
  sessionToken: string,
  expiresAt: Date,
): void {
  const environment = loadEnvironment(process.env);
  response.headers.set(
    'set-cookie',
    serializeSessionCookie(sessionToken, expiresAt, {
      isProduction: environment.isProduction,
    }),
  );
}

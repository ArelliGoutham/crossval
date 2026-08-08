import { type NextRequest, NextResponse } from 'next/server';

import {
  createIdentityModule,
} from '@/modules/identity/infrastructure/create-identity-module';
import { signUpInputSchema } from '@/modules/identity/public';
import {
  dataResponse,
  InvalidJsonError,
  mapErrorResponse,
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

    const credentials = signUpInputSchema.parse(await readJson(request));
    const identityModule = await createIdentityModule();
    const result = await identityModule.signUp(credentials);
    const response = dataResponse(
      {
        user: {
          userId: result.identity.userId,
          merchantId: result.identity.merchantId,
          email: credentials.email,
        },
      },
      201,
    );

    setSessionCookie(response, result.session.token, result.session.expiresAt);

    return response;
  } catch (error: unknown) {
    return mapErrorResponse(error, context.requestId);
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
    serializeSessionCookie(sessionToken, expiresAt, environment.isProduction),
  );
}

function serializeSessionCookie(
  sessionToken: string,
  expiresAt: Date,
  isProduction: boolean,
): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${sessionToken}`,
    'Path=/',
    `Expires=${expiresAt.toUTCString()}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (isProduction) {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}

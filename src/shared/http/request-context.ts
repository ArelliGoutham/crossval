import { randomUUID } from 'node:crypto';

import type { NextRequest } from 'next/server';

export const SESSION_COOKIE_NAME = 'session';

export interface RequestContext {
  requestId: string;
  sessionToken: string | null;
}

export function createRequestContext(request: NextRequest): RequestContext {
  return {
    requestId: randomUUID(),
    sessionToken: request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null,
  };
}

import type { NextRequest } from 'next/server';

import { InvalidOriginError } from '@/shared/http/api-response';

export function assertSameOrigin(
  request: NextRequest,
  appOrigin: string,
): void {
  const configuredOrigin = new URL(appOrigin);
  const originHeader = request.headers.get('origin');
  const hostHeader =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host');

  if (
    originHeader === null ||
    hostHeader === null ||
    originHeader !== configuredOrigin.origin ||
    hostHeader !== configuredOrigin.host
  ) {
    throw new InvalidOriginError();
  }
}

import { SESSION_COOKIE_NAME } from '@/shared/http/request-context';

interface SessionCookieOptions {
  readonly isProduction: boolean;
}

export function serializeSessionCookie(
  sessionToken: string,
  expiresAt: Date,
  options: SessionCookieOptions,
): string {
  return buildCookie(attributes(sessionToken, expiresAt, options));
}

export function serializeClearedSessionCookie(
  options: SessionCookieOptions,
): string {
  return buildCookie(clearAttributes(options));
}

function buildCookie(attributes: string[]): string {
  return attributes.join('; ');
}

function attributes(
  sessionToken: string,
  expiresAt: Date,
  options: SessionCookieOptions,
): string[] {
  const attrs = [
    `${SESSION_COOKIE_NAME}=${sessionToken}`,
    'Path=/',
    `Expires=${expiresAt.toUTCString()}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (options.isProduction) {
    attrs.push('Secure');
  }

  return attrs;
}

function clearAttributes(options: SessionCookieOptions): string[] {
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    `Expires=${new Date(0).toUTCString()}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (options.isProduction) {
    attrs.push('Secure');
  }

  return attrs;
}

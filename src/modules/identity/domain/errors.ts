export type IdentityErrorCode =
  'invalid_credentials' | 'duplicate_email' | 'unauthorized';

export class IdentityError extends Error {
  readonly code: IdentityErrorCode;

  constructor(code: IdentityErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'IdentityError';
  }
}

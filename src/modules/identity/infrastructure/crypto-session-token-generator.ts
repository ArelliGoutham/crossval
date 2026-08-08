import { createHash, randomBytes } from 'node:crypto';

import type { SessionTokenGenerator } from '@/modules/identity/domain/ports';

export class CryptoSessionTokenGenerator implements SessionTokenGenerator {
  async generate(): Promise<string> {
    return randomBytes(32).toString('base64url');
  }

  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

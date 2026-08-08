import { createHash, randomBytes } from 'node:crypto';

import type {
  SessionTokenGenerator,
  SessionTokenHasher,
} from '@/modules/identity/domain/ports';

export class CryptoSessionTokenGenerator
  implements SessionTokenGenerator, SessionTokenHasher
{
  async generate(): Promise<string> {
    return randomBytes(32).toString('base64url');
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

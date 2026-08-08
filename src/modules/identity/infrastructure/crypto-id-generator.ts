import { randomUUID } from 'node:crypto';

import type { IdGenerator } from '@/modules/identity/domain/ports';

export class CryptoIdGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}

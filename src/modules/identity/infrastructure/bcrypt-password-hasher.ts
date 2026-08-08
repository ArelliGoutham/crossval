import { compare, hash } from 'bcrypt';

import type { PasswordHasher } from '@/modules/identity/domain/ports';

export class BcryptPasswordHasher implements PasswordHasher {
  readonly #cost: number;

  constructor(cost: number) {
    this.#cost = cost;
  }

  hash(password: string): Promise<string> {
    return hash(password, this.#cost);
  }

  verify(password: string, passwordHash: string): Promise<boolean> {
    return compare(password, passwordHash);
  }
}

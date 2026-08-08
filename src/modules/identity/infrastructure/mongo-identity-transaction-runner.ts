import type { Db, MongoClient } from 'mongodb';

import type {
  IdentityTransaction,
  IdentityTransactionRunner,
} from '@/modules/identity/domain/ports';
import { MongoAuditLog } from '@/modules/identity/infrastructure/mongo-audit-log';
import { MongoSessionRepository } from '@/modules/identity/infrastructure/mongo-session-repository';
import { MongoUserRepository } from '@/modules/identity/infrastructure/mongo-user-repository';

export class MongoIdentityTransactionRunner implements IdentityTransactionRunner {
  readonly #client: MongoClient;
  readonly #database: Db;

  constructor(client: MongoClient, database: Db) {
    this.#client = client;
    this.#database = database;
  }

  async run<T>(
    operation: (identity: IdentityTransaction) => Promise<T>,
  ): Promise<T> {
    const session = this.#client.startSession();
    let completion: { value: T } | undefined;

    try {
      await session.withTransaction(async () => {
        const users = new MongoUserRepository(this.#database, session);
        const sessions = new MongoSessionRepository(this.#database, session);
        const audit = new MongoAuditLog(this.#database, session);

        completion = {
          value: await operation({
            insertUser: (user) => users.insert(user),
            insertSession: (identitySession) =>
              sessions.insert(identitySession),
            revokeActiveByTokenHash: (tokenHash, revokedAt) =>
              sessions.revokeActiveByTokenHash(tokenHash, revokedAt),
            recordAudit: (event) => audit.record(event),
          }),
        };
      });
    } finally {
      await session.endSession();
    }

    if (completion === undefined) {
      throw new Error('Identity transaction completed without a result');
    }

    return completion.value;
  }
}

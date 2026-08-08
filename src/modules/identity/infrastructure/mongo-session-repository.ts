import type { Collection, Db, WithId } from 'mongodb';

import type { SessionRepository } from '@/modules/identity/domain/ports';
import type {
  NewStoredSession,
  StoredSession,
} from '@/modules/identity/domain/types';

type SessionDocument = {
  id: string;
  userId: string;
  merchantId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
};

export class MongoSessionRepository implements SessionRepository {
  readonly #collection: Collection<SessionDocument>;

  constructor(database: Db) {
    this.#collection = database.collection<SessionDocument>('sessions');
  }

  async insert(session: NewStoredSession): Promise<void> {
    await this.#collection.insertOne({
      id: session.id,
      userId: session.userId,
      merchantId: session.merchantId,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      revokedAt: null,
    });
  }

  async findActiveByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<StoredSession | null> {
    const document = await this.#collection.findOne({
      tokenHash,
      revokedAt: null,
      expiresAt: { $gt: now },
    });

    return document === null ? null : toStoredSession(document);
  }

  async revokeByTokenHash(tokenHash: string, revokedAt: Date): Promise<void> {
    await this.#collection.updateOne(
      { tokenHash },
      {
        $set: {
          revokedAt,
        },
      },
    );
  }
}

function toStoredSession(document: WithId<SessionDocument>): StoredSession {
  return {
    id: document.id,
    userId: document.userId,
    merchantId: document.merchantId,
    tokenHash: document.tokenHash,
    expiresAt: document.expiresAt,
    createdAt: document.createdAt,
    revokedAt: document.revokedAt,
  };
}

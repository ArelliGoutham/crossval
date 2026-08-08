import type { ClientSession, Collection, Db, WithId } from 'mongodb';

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
  readonly #session: ClientSession | undefined;

  constructor(database: Db, session?: ClientSession) {
    this.#collection = database.collection<SessionDocument>('sessions');
    this.#session = session;
  }

  async insert(session: NewStoredSession): Promise<void> {
    await this.#collection.insertOne(
      {
        id: session.id,
        userId: session.userId,
        merchantId: session.merchantId,
        tokenHash: session.tokenHash,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
        revokedAt: null,
      },
      { session: this.#session },
    );
  }

  async findActiveByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<StoredSession | null> {
    const document = await this.#collection.findOne(
      {
        tokenHash,
        revokedAt: null,
        expiresAt: { $gt: now },
      },
      { session: this.#session },
    );

    return document === null ? null : toStoredSession(document);
  }

  async revokeActiveByTokenHash(
    tokenHash: string,
    revokedAt: Date,
  ): Promise<StoredSession | null> {
    const document = await this.#collection.findOneAndUpdate(
      {
        tokenHash,
        revokedAt: null,
        expiresAt: { $gt: revokedAt },
      },
      {
        $set: {
          revokedAt,
        },
      },
      { returnDocument: 'after', session: this.#session },
    );

    return document === null ? null : toStoredSession(document);
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

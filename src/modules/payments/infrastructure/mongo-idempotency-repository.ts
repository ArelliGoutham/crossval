import { MongoServerError, type ClientSession, Collection, Db } from 'mongodb';

import type {
  IdempotencyClaimResult,
  IdempotencyRepository,
} from '@/modules/payments/domain/ports';
import type { IdempotencyRecord } from '@/modules/payments/domain/types';

type IdempotencyDocument = {
  merchantId: string;
  operation: string;
  key: string;
  requestHash: string;
  outcome: 'succeeded' | 'rejected' | null;
  response: Record<string, unknown> | null;
  createdAt: Date;
  completedAt: Date | null;
};

export class MongoIdempotencyRepository implements IdempotencyRepository {
  readonly #collection: Collection<IdempotencyDocument>;
  readonly #session: ClientSession | undefined;

  constructor(database: Db, session?: ClientSession) {
    this.#collection =
      database.collection<IdempotencyDocument>('idempotency_records');
    this.#session = session;
  }

  async claim(
    record: {
      merchantId: string;
      operation: string;
      key: string;
      requestHash: string;
    },
    now: Date,
  ): Promise<IdempotencyClaimResult> {
    const existing = await this.#collection.findOne(
      {
        merchantId: record.merchantId,
        operation: record.operation,
        key: record.key,
      },
      { session: this.#session },
    );

    if (existing !== null) {
      if (existing.requestHash !== record.requestHash) {
        return { status: 'conflict' };
      }
      if (existing.outcome !== null) {
        return {
          status: 'completed',
          record: toIdempotencyRecord(existing),
        };
      }
      return { status: 'claimed' };
    }

    try {
      await this.#collection.insertOne(
        {
          merchantId: record.merchantId,
          operation: record.operation,
          key: record.key,
          requestHash: record.requestHash,
          outcome: null,
          response: null,
          createdAt: now,
          completedAt: null,
        },
        { session: this.#session },
      );
      return { status: 'claimed' };
    } catch (error: unknown) {
      if (error instanceof MongoServerError && error.code === 11000) {
        const concurrent = await this.#collection.findOne(
          {
            merchantId: record.merchantId,
            operation: record.operation,
            key: record.key,
          },
          { session: this.#session },
        );

        if (concurrent !== null) {
          if (concurrent.requestHash !== record.requestHash) {
            return { status: 'conflict' };
          }
          if (concurrent.outcome !== null) {
            return {
              status: 'completed',
              record: toIdempotencyRecord(concurrent),
            };
          }
          return { status: 'claimed' };
        }
      }
      throw error;
    }
  }

  async complete(
    merchantId: string,
    operation: string,
    key: string,
    outcome: 'succeeded' | 'rejected',
    response: Readonly<Record<string, unknown>>,
    now: Date,
  ): Promise<void> {
    await this.#collection.updateOne(
      { merchantId, operation, key },
      {
        $set: {
          outcome,
          response: { ...response },
          completedAt: now,
        },
      },
      { session: this.#session },
    );
  }
}

function toIdempotencyRecord(doc: IdempotencyDocument): IdempotencyRecord {
  return {
    merchantId: doc.merchantId,
    operation: doc.operation,
    key: doc.key,
    requestHash: doc.requestHash,
    outcome: doc.outcome as 'succeeded' | 'rejected',
    response: doc.response ?? {},
    createdAt: doc.createdAt,
    completedAt: doc.completedAt ?? doc.createdAt,
  };
}

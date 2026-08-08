import {
  MongoServerError,
  type ClientSession,
  type Collection,
  type Db,
  type WithId,
} from 'mongodb';

import { IdentityError } from '@/modules/identity/domain/errors';
import type { UserRepository } from '@/modules/identity/domain/ports';
import type {
  NewStoredUser,
  StoredUser,
} from '@/modules/identity/domain/types';

type UserDocument = {
  id: string;
  merchantId: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};

export class MongoUserRepository implements UserRepository {
  readonly #collection: Collection<UserDocument>;
  readonly #session: ClientSession | undefined;

  constructor(database: Db, session?: ClientSession) {
    this.#collection = database.collection<UserDocument>('users');
    this.#session = session;
  }

  async findByNormalizedEmail(email: string): Promise<StoredUser | null> {
    const document = await this.#collection.findOne(
      { email },
      { session: this.#session },
    );

    return document === null ? null : toStoredUser(document);
  }

  async insert(user: NewStoredUser): Promise<StoredUser> {
    try {
      await this.#collection.insertOne(
        {
          id: user.id,
          merchantId: user.merchantId,
          email: user.email,
          passwordHash: user.passwordHash,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        { session: this.#session },
      );
    } catch (error: unknown) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new IdentityError('duplicate_email');
      }

      throw error;
    }

    return {
      id: user.id,
      merchantId: user.merchantId,
      email: user.email,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

function toStoredUser(document: WithId<UserDocument>): StoredUser {
  return {
    id: document.id,
    merchantId: document.merchantId,
    email: document.email,
    passwordHash: document.passwordHash,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

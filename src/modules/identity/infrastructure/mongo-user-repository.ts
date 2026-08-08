import {
  MongoServerError,
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

  constructor(database: Db) {
    this.#collection = database.collection<UserDocument>('users');
  }

  async findByNormalizedEmail(email: string): Promise<StoredUser | null> {
    const document = await this.#collection.findOne({ email });

    return document === null ? null : toStoredUser(document);
  }

  async insert(user: NewStoredUser): Promise<StoredUser> {
    try {
      await this.#collection.insertOne({
        id: user.id,
        merchantId: user.merchantId,
        email: user.email,
        passwordHash: user.passwordHash,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
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

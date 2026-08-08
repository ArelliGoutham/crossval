import { expect, test } from 'vitest';

import { getMongoClient } from '@/shared/mongodb/client';

process.env.MONGODB_URI = 'mongodb://localhost:27018/?replicaSet=rs0';
process.env.MONGODB_DB_NAME = 'crossval';
process.env.APP_ORIGIN = 'http://localhost:3000';
process.env.SESSION_TTL_DAYS = '7';
process.env.BCRYPT_COST = '12';
process.env.BCRYPT_DUMMY_HASH =
  '$2b$12$6pXXnmXUHS4PXpEO6JeKFuq/7/7myFbHw9ZouzgxJK1YLAUNhx4wa';

test('the documented host URI supports a transaction through the shared client', async () => {
  const client = await getMongoClient();

  try {
    const session = client.startSession();

    try {
      session.startTransaction();

      const result = await client
        .db('crossval')
        .collection('task_2_host_connection_verification')
        .insertOne({ verifiedAt: new Date() }, { session });

      expect(result.acknowledged).toBe(true);

      await session.abortTransaction();
    } finally {
      await session.endSession();
    }
  } finally {
    await client.close();
  }
});

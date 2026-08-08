import type { Db } from 'mongodb';

export async function ensureIdentityIndexes(database: Db): Promise<void> {
  await Promise.all([
    database.collection('users').createIndex(
      { email: 1 },
      {
        name: 'email_unique',
        unique: true,
      },
    ),
    database.collection('sessions').createIndex(
      { tokenHash: 1 },
      {
        name: 'tokenHash_unique',
        unique: true,
      },
    ),
    database.collection('sessions').createIndex(
      { expiresAt: 1 },
      {
        name: 'expiresAt_ttl',
        expireAfterSeconds: 0,
      },
    ),
  ]);
}

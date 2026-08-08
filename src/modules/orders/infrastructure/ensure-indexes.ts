import type { Db } from 'mongodb';

export async function ensureOrderIndexes(database: Db): Promise<void> {
  await Promise.all([
    database.collection('orders').createIndex(
      { merchantId: 1, createdAt: -1 },
      { name: 'merchantId_createdAt' },
    ),
    database.collection('orders').createIndex(
      { merchantId: 1, dueDate: 1 },
      { name: 'merchantId_dueDate' },
    ),
    database.collection('orders').createIndex(
      { merchantId: 1, deletedAt: 1 },
      { name: 'merchantId_deletedAt' },
    ),
  ]);
}

import type { Db } from 'mongodb';

export async function ensurePaymentIndexes(database: Db): Promise<void> {
  await Promise.all([
    database.collection('payments').createIndex(
      { merchantId: 1, orderId: 1, paymentDate: -1 },
      { name: 'merchantId_orderId_paymentDate' },
    ),
    database.collection('idempotency_records').createIndex(
      { merchantId: 1, operation: 1, key: 1 },
      { name: 'merchantId_operation_key_unique', unique: true },
    ),
  ]);
}

import { randomUUID } from 'node:crypto';

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';
import { type Db, MongoClient } from 'mongodb';

import { ensureOrderIndexes } from '@/modules/orders/infrastructure/ensure-indexes';
import { MongoOrderRepository } from '@/modules/orders/infrastructure/mongo-order-repository';
import { MongoOrderSettlementPort } from '@/modules/orders/infrastructure/mongo-order-settlement-port';
import { ensurePaymentIndexes } from '@/modules/payments/infrastructure/ensure-indexes';
import { MongoIdempotencyRepository } from '@/modules/payments/infrastructure/mongo-idempotency-repository';
import { MongoPaymentRepository } from '@/modules/payments/infrastructure/mongo-payment-repository';
import { resolveMongoClientOptions } from '@/shared/mongodb/client';

const mongodbUri = 'mongodb://localhost:27018/?replicaSet=rs0';
const databaseName = `crossval_payments_test_${randomUUID()}`;

describe('payments infrastructure adapters', () => {
  let client: MongoClient;
  let database: Db;

  beforeAll(async () => {
    client = await MongoClient.connect(
      mongodbUri,
      resolveMongoClientOptions(mongodbUri),
    );
    database = client.db(databaseName);
    await ensureOrderIndexes(database);
    await ensurePaymentIndexes(database);
  });

  beforeEach(async () => {
    await database.dropDatabase();
    await ensureOrderIndexes(database);
    await ensurePaymentIndexes(database);
  });

  afterAll(async () => {
    await database.dropDatabase();
    await client.close();
  });

  async function seedOrder(
    id: string,
    merchantId: string,
    totalMinor: number,
  ): Promise<void> {
    const repo = new MongoOrderRepository(database);
    const now = new Date('2026-08-08T10:00:00.000Z');
    await repo.insert({
      id,
      merchantId,
      customer: 'Test Customer',
      dueDate: '2026-08-15',
      lineItems: [
        {
          id: `${id}-line`,
          description: 'Item',
          quantity: 1,
          unitPriceMinor: totalMinor,
          lineTotalMinor: totalMinor,
        },
      ],
      subtotalMinor: totalMinor,
      totalMinor,
      amountPaidMinor: 0,
      paymentCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  test('payment repository inserts and lists payments', async () => {
    const repo = new MongoPaymentRepository(database);
    const now = new Date();

    await repo.insert({
      id: 'pay-1',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      amountMinor: 40000,
      paymentDate: '2026-08-08',
      note: 'first',
      idempotencyKey: 'key-1',
      createdBy: 'user-1',
      createdAt: now,
    });

    const list = await repo.listByOrderId('merchant-1', 'order-1');
    expect(list).toHaveLength(1);
    expect(list[0]?.amountMinor).toBe(40000);
  });

  test('payment repository count by orderId', async () => {
    const repo = new MongoPaymentRepository(database);
    const now = new Date();

    await repo.insert({
      id: 'pay-1',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      amountMinor: 40000,
      paymentDate: '2026-08-08',
      note: null,
      idempotencyKey: 'key-1',
      createdBy: 'user-1',
      createdAt: now,
    });

    const count = await repo.countByOrderId('merchant-1', 'order-1');
    expect(count).toBe(1);
  });

  test('idempotency repository claim and complete', async () => {
    const repo = new MongoIdempotencyRepository(database);
    const now = new Date();

    const claim1 = await repo.claim(
      { merchantId: 'merchant-1', operation: 'recordPayment', key: 'key-1', requestHash: 'hash-1' },
      now,
    );
    expect(claim1.status).toBe('claimed');

    await repo.complete(
      'merchant-1',
      'recordPayment',
      'key-1',
      'succeeded',
      { result: { id: 'pay-1' }, httpStatus: 201 },
      now,
    );

    const claim2 = await repo.claim(
      { merchantId: 'merchant-1', operation: 'recordPayment', key: 'key-1', requestHash: 'hash-1' },
      now,
    );
    expect(claim2.status).toBe('completed');
  });

  test('idempotency repository detects conflict on different hash', async () => {
    const repo = new MongoIdempotencyRepository(database);
    const now = new Date();

    await repo.claim(
      { merchantId: 'merchant-1', operation: 'recordPayment', key: 'key-1', requestHash: 'hash-1' },
      now,
    );

    const claim = await repo.claim(
      { merchantId: 'merchant-1', operation: 'recordPayment', key: 'key-1', requestHash: 'hash-2' },
      now,
    );
    expect(claim.status).toBe('conflict');
  });

  test('settlement port getOrderSnapshot returns order data', async () => {
    await seedOrder('order-1', 'merchant-1', 100000);

    const session = client.startSession();
    try {
      const port = new MongoOrderSettlementPort(database, session);
      const snapshot = await port.getOrderSnapshot('merchant-1', 'order-1');
      expect(snapshot).not.toBeNull();
      expect(snapshot?.totalMinor).toBe(100000);
      expect(snapshot?.amountPaidMinor).toBe(0);
      expect(snapshot?.dueDate).toBe('2026-08-15');
    } finally {
      await session.endSession();
    }
  });

  test('settlement port getOrderSnapshot returns null for missing order', async () => {
    const session = client.startSession();
    try {
      const port = new MongoOrderSettlementPort(database, session);
      const snapshot = await port.getOrderSnapshot('merchant-1', 'nonexistent');
      expect(snapshot).toBeNull();
    } finally {
      await session.endSession();
    }
  });

  test('settlement port reserveBalance succeeds then rejects over-payment', async () => {
    await seedOrder('order-1', 'merchant-1', 100000);

    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        const port = new MongoOrderSettlementPort(database, session);

        const result1 = await port.reserveBalance('merchant-1', 'order-1', 60000);
        expect(result1.succeeded).toBe(true);
        if (result1.succeeded) {
          expect(result1.amountPaidMinor).toBe(60000);
        }

        const result2 = await port.reserveBalance('merchant-1', 'order-1', 50000);
        expect(result2.succeeded).toBe(false);
        if (!result2.succeeded) {
          expect(result2.maximumAllowedAmountMinor).toBe(40000);
        }
      });
    } finally {
      await session.endSession();
    }
  });
});

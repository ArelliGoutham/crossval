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
import { MongoOrderAuditLog } from '@/modules/orders/infrastructure/mongo-order-audit-log';
import { MongoOrderRepository } from '@/modules/orders/infrastructure/mongo-order-repository';
import { resolveMongoClientOptions } from '@/shared/mongodb/client';

const mongodbUri = 'mongodb://localhost:27018/?replicaSet=rs0';
const databaseName = `crossval_orders_test_${randomUUID()}`;

describe('orders infrastructure adapters', () => {
  let client: MongoClient;
  let database: Db;

  beforeAll(async () => {
    client = await MongoClient.connect(
      mongodbUri,
      resolveMongoClientOptions(mongodbUri),
    );
    database = client.db(databaseName);
    await ensureOrderIndexes(database);
  });

  beforeEach(async () => {
    await database.dropDatabase();
    await ensureOrderIndexes(database);
  });

  afterAll(async () => {
    await database.dropDatabase();
    await client.close();
  });

  test('inserts and retrieves an order by merchant and id', async () => {
    const repo = new MongoOrderRepository(database);
    const now = new Date('2026-08-08T10:00:00.000Z');

    await repo.insert({
      id: 'order-1',
      merchantId: 'merchant-1',
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        {
          id: 'line-1',
          description: 'Widget',
          quantity: 2,
          unitPriceMinor: 50000,
          lineTotalMinor: 100000,
        },
      ],
      subtotalMinor: 100000,
      totalMinor: 100000,
      amountPaidMinor: 0,
      paymentCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    const found = await repo.findById('merchant-1', 'order-1');
    expect(found).not.toBeNull();
    expect(found?.customer).toBe('Acme Corp');
    expect(found?.totalMinor).toBe(100000);
    expect(found?.deletedAt).toBeNull();
  });

  test('cross-merchant findById returns null', async () => {
    const repo = new MongoOrderRepository(database);
    const now = new Date();

    await repo.insert({
      id: 'order-1',
      merchantId: 'merchant-1',
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [],
      subtotalMinor: 0,
      totalMinor: 0,
      amountPaidMinor: 0,
      paymentCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    const found = await repo.findById('merchant-2', 'order-1');
    expect(found).toBeNull();
  });

  test('listActive returns only active orders for the merchant', async () => {
    const repo = new MongoOrderRepository(database);
    const now = new Date();

    await repo.insert({
      id: 'order-1',
      merchantId: 'merchant-1',
      customer: 'Acme',
      dueDate: '2026-08-15',
      lineItems: [],
      subtotalMinor: 0,
      totalMinor: 0,
      amountPaidMinor: 0,
      paymentCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await repo.softDelete('merchant-1', 'order-1', now);

    await repo.insert({
      id: 'order-2',
      merchantId: 'merchant-1',
      customer: 'Other',
      dueDate: '2026-08-15',
      lineItems: [],
      subtotalMinor: 0,
      totalMinor: 0,
      amountPaidMinor: 0,
      paymentCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    const list = await repo.listActive('merchant-1');
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('order-2');
  });

  test('update changes customer and dueDate', async () => {
    const repo = new MongoOrderRepository(database);
    const now = new Date();

    await repo.insert({
      id: 'order-1',
      merchantId: 'merchant-1',
      customer: 'Acme',
      dueDate: '2026-08-15',
      lineItems: [],
      subtotalMinor: 0,
      totalMinor: 0,
      amountPaidMinor: 0,
      paymentCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    const updated = await repo.update('merchant-1', 'order-1', {
      customer: 'Updated',
      dueDate: '2026-08-20',
      lineItems: [],
      subtotalMinor: 0,
      totalMinor: 0,
      updatedAt: new Date(),
    });

    expect(updated?.customer).toBe('Updated');
    expect(updated?.dueDate).toBe('2026-08-20');
  });

  test('softDelete sets deletedAt and hides from reads', async () => {
    const repo = new MongoOrderRepository(database);
    const now = new Date();

    await repo.insert({
      id: 'order-1',
      merchantId: 'merchant-1',
      customer: 'Acme',
      dueDate: '2026-08-15',
      lineItems: [],
      subtotalMinor: 0,
      totalMinor: 0,
      amountPaidMinor: 0,
      paymentCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    const deleted = await repo.softDelete('merchant-1', 'order-1', now);
    expect(deleted?.deletedAt).toEqual(now);

    const found = await repo.findById('merchant-1', 'order-1');
    expect(found).toBeNull();
  });

  test('audit log records order events', async () => {
    const audit = new MongoOrderAuditLog(database);
    const now = new Date();

    await audit.record({
      action: 'orders.create.succeeded',
      occurredAt: now,
      merchantId: 'merchant-1',
      orderId: 'order-1',
      actorId: 'user-1',
      changedFields: [],
    });

    const docs = await database.collection('orders_audit_log').find().toArray();

    expect(docs).toHaveLength(1);
    expect(docs[0]?.action).toBe('orders.create.succeeded');
    expect(docs[0]?.orderId).toBe('order-1');
  });
});

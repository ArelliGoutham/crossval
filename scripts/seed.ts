import { hash } from 'bcrypt';
import { MongoClient } from 'mongodb';

const SEED_EMAIL = 'demo@crossval.app';
const SEED_PASSWORD = 'demo-password-12';

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME ?? 'crossval';

  if (!uri) {
    console.error(
      'MONGODB_URI is required. Set it in .env.local or environment.',
    );
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  const client = await MongoClient.connect(uri);
  const database = client.db(dbName);

  const merchantId = 'demo-merchant-001';
  const userId = 'demo-user-001';
  const passwordHash = await hash(SEED_PASSWORD, 12);
  const now = new Date();

  await database.collection('users').updateOne(
    { email: SEED_EMAIL },
    {
      $set: {
        id: userId,
        merchantId,
        email: SEED_EMAIL,
        passwordHash,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );

  console.log(`Seed user: ${SEED_EMAIL} / ${SEED_PASSWORD}`);

  await database.collection('orders').deleteMany({ merchantId });
  await database.collection('payments').deleteMany({ merchantId });
  await database.collection('orders_audit_log').deleteMany({ merchantId });
  await database.collection('payments_audit_log').deleteMany({ merchantId });

  const orders: Record<string, unknown>[] = [];
  const payments: Record<string, unknown>[] = [];

  const today = now.toISOString().slice(0, 10);
  const inDays = (n: number) =>
    new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

  // 1. Pending — no payments, due in 7 days
  orders.push({
    id: 'order-pending-001',
    merchantId,
    customer: 'Acme Industries',
    dueDate: inDays(7),
    lineItems: [
      {
        id: 'li-1',
        description: 'Consulting Services',
        quantity: 10,
        unitPriceMinor: 15000,
        lineTotalMinor: 150000,
      },
    ],
    subtotalMinor: 150000,
    totalMinor: 150000,
    amountPaidMinor: 0,
    paymentCount: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });

  // 2. Partially paid — $500 of $1000
  orders.push({
    id: 'order-partial-001',
    merchantId,
    customer: 'Globex Corporation',
    dueDate: inDays(14),
    lineItems: [
      {
        id: 'li-2',
        description: 'Enterprise License',
        quantity: 1,
        unitPriceMinor: 60000,
        lineTotalMinor: 60000,
      },
      {
        id: 'li-3',
        description: 'Premium Support',
        quantity: 1,
        unitPriceMinor: 40000,
        lineTotalMinor: 40000,
      },
    ],
    subtotalMinor: 100000,
    totalMinor: 100000,
    amountPaidMinor: 50000,
    paymentCount: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
  payments.push({
    id: 'pay-partial-001',
    merchantId,
    orderId: 'order-partial-001',
    amountMinor: 50000,
    paymentDate: today,
    note: 'Initial deposit',
    idempotencyKey: 'seed-key-1',
    createdBy: userId,
    createdAt: now,
  });

  // 3. Fully paid — $750, two payments
  orders.push({
    id: 'order-paid-001',
    merchantId,
    customer: 'Initech LLC',
    dueDate: inDays(3),
    lineItems: [
      {
        id: 'li-4',
        description: 'Software Subscription',
        quantity: 3,
        unitPriceMinor: 20000,
        lineTotalMinor: 60000,
      },
      {
        id: 'li-5',
        description: 'Setup Fee',
        quantity: 1,
        unitPriceMinor: 15000,
        lineTotalMinor: 15000,
      },
    ],
    subtotalMinor: 75000,
    totalMinor: 75000,
    amountPaidMinor: 75000,
    paymentCount: 2,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
  payments.push({
    id: 'pay-paid-001',
    merchantId,
    orderId: 'order-paid-001',
    amountMinor: 30000,
    paymentDate: inDays(-2),
    note: 'First payment',
    idempotencyKey: 'seed-key-2',
    createdBy: userId,
    createdAt: new Date(Date.now() - 2 * 86400000),
  });
  payments.push({
    id: 'pay-paid-002',
    merchantId,
    orderId: 'order-paid-001',
    amountMinor: 45000,
    paymentDate: inDays(-1),
    note: 'Final payment',
    idempotencyKey: 'seed-key-3',
    createdBy: userId,
    createdAt: new Date(Date.now() - 86400000),
  });

  // 4. Overdue — no payments, due 30 days ago
  orders.push({
    id: 'order-overdue-001',
    merchantId,
    customer: 'Umbrella Corp',
    dueDate: inDays(-30),
    lineItems: [
      {
        id: 'li-6',
        description: 'Annual Contract',
        quantity: 1,
        unitPriceMinor: 200000,
        lineTotalMinor: 200000,
      },
    ],
    subtotalMinor: 200000,
    totalMinor: 200000,
    amountPaidMinor: 0,
    paymentCount: 0,
    createdAt: new Date(Date.now() - 35 * 86400000),
    updatedAt: new Date(Date.now() - 35 * 86400000),
    deletedAt: null,
  });

  // 5. Overdue + partial — $300 of $1000, due 10 days ago
  orders.push({
    id: 'order-overdue-partial-001',
    merchantId,
    customer: 'Stark Industries',
    dueDate: inDays(-10),
    lineItems: [
      {
        id: 'li-7',
        description: 'R&D Equipment',
        quantity: 2,
        unitPriceMinor: 50000,
        lineTotalMinor: 100000,
      },
    ],
    subtotalMinor: 100000,
    totalMinor: 100000,
    amountPaidMinor: 30000,
    paymentCount: 1,
    createdAt: new Date(Date.now() - 15 * 86400000),
    updatedAt: new Date(Date.now() - 15 * 86400000),
    deletedAt: null,
  });
  payments.push({
    id: 'pay-overdue-partial-001',
    merchantId,
    orderId: 'order-overdue-partial-001',
    amountMinor: 30000,
    paymentDate: inDays(-12),
    note: 'Partial advance',
    idempotencyKey: 'seed-key-4',
    createdBy: userId,
    createdAt: new Date(Date.now() - 12 * 86400000),
  });

  // 6. Another pending — small, due tomorrow
  orders.push({
    id: 'order-pending-002',
    merchantId,
    customer: 'Wayne Enterprises',
    dueDate: inDays(1),
    lineItems: [
      {
        id: 'li-8',
        description: 'Security Audit',
        quantity: 1,
        unitPriceMinor: 25000,
        lineTotalMinor: 25000,
      },
    ],
    subtotalMinor: 25000,
    totalMinor: 25000,
    amountPaidMinor: 0,
    paymentCount: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });

  await database.collection('orders').insertMany(orders);
  console.log(`Inserted ${orders.length} orders`);

  if (payments.length > 0) {
    await database.collection('payments').insertMany(payments);
    console.log(`Inserted ${payments.length} payments`);
  }

  console.log('');
  console.log('Seed complete! Login credentials:');
  console.log(`  Email:    ${SEED_EMAIL}`);
  console.log(`  Password: ${SEED_PASSWORD}`);
  console.log('');
  console.log('Orders created:');
  console.log('  1. Acme Industries       — pending         — $1,500.00 due');
  console.log(
    '  2. Globex Corporation    — partially paid  — $500.00 of $1,000.00',
  );
  console.log(
    '  3. Initech LLC           — paid            — $750.00 (2 payments)',
  );
  console.log('  4. Umbrella Corp         — overdue         — $2,000.00 due');
  console.log(
    '  5. Stark Industries      — overdue         — $700.00 of $1,000.00',
  );
  console.log(
    '  6. Wayne Enterprises     — pending         — $250.00 (due tomorrow)',
  );

  await client.close();
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});

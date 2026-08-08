import { PaymentService } from '@/modules/payments/application/payment-service';
import { MongoPaymentRepository } from '@/modules/payments/infrastructure/mongo-payment-repository';
import { MongoPaymentTransactionRunner } from '@/modules/payments/infrastructure/mongo-payment-transaction-runner';
import { ensurePaymentIndexes } from '@/modules/payments/infrastructure/ensure-indexes';
import { CryptoIdGenerator } from '@/modules/identity/infrastructure/crypto-id-generator';
import { SystemClock } from '@/modules/identity/infrastructure/system-clock';
import { loadEnvironment } from '@/shared/config/environment';
import { getMongoClient } from '@/shared/mongodb/client';

let paymentsModulePromise: Promise<PaymentService> | undefined;

export function createPaymentsModule(): Promise<PaymentService> {
  paymentsModulePromise ??= createPaymentsModuleInternal();
  return paymentsModulePromise;
}

async function createPaymentsModuleInternal(): Promise<PaymentService> {
  const environment = loadEnvironment(process.env);
  const client = await getMongoClient();
  const database = client.db(environment.mongodbDatabaseName);

  await ensurePaymentIndexes(database);

  return new PaymentService({
    payments: new MongoPaymentRepository(database),
    transactions: new MongoPaymentTransactionRunner(client, database),
    clock: new SystemClock(),
    ids: new CryptoIdGenerator(),
  });
}

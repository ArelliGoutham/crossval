import { OrderService } from '@/modules/orders/application/order-service';
import { MongoOrderAuditLog } from '@/modules/orders/infrastructure/mongo-order-audit-log';
import { MongoOrderRepository } from '@/modules/orders/infrastructure/mongo-order-repository';
import { ensureOrderIndexes } from '@/modules/orders/infrastructure/ensure-indexes';
import { CryptoIdGenerator } from '@/modules/identity/infrastructure/crypto-id-generator';
import { SystemClock } from '@/modules/identity/infrastructure/system-clock';
import { loadEnvironment } from '@/shared/config/environment';
import { getMongoClient } from '@/shared/mongodb/client';

let ordersModulePromise: Promise<OrderService> | undefined;

export function createOrdersModule(): Promise<OrderService> {
  ordersModulePromise ??= createOrdersModuleInternal();

  return ordersModulePromise;
}

async function createOrdersModuleInternal(): Promise<OrderService> {
  const environment = loadEnvironment(process.env);
  const client = await getMongoClient();
  const database = client.db(environment.mongodbDatabaseName);

  await ensureOrderIndexes(database);

  return new OrderService({
    orders: new MongoOrderRepository(database),
    audit: new MongoOrderAuditLog(database),
    clock: new SystemClock(),
    ids: new CryptoIdGenerator(),
  });
}

import type { ClientSession, Db, MongoClient } from 'mongodb';

import type {
  PaymentTransaction,
  PaymentTransactionRunner,
} from '@/modules/payments/domain/ports';
import { MongoOrderSettlementPort } from '@/modules/orders/infrastructure/mongo-order-settlement-port';
import { MongoPaymentRepository } from '@/modules/payments/infrastructure/mongo-payment-repository';
import { MongoIdempotencyRepository } from '@/modules/payments/infrastructure/mongo-idempotency-repository';
import { MongoPaymentAuditLog } from '@/modules/payments/infrastructure/mongo-payment-audit-log';

export class MongoPaymentTransactionRunner
  implements PaymentTransactionRunner
{
  readonly #client: MongoClient;
  readonly #database: Db;

  constructor(client: MongoClient, database: Db) {
    this.#client = client;
    this.#database = database;
  }

  async run<T>(
    operation: (tx: PaymentTransaction) => Promise<T>,
  ): Promise<T> {
    const session = this.#client.startSession();
    let completion: { value: T } | undefined;

    try {
      await session.withTransaction(async () => {
        const settlement = new MongoOrderSettlementPort(this.#database, session);
        const payments = new MongoPaymentRepository(this.#database, session);
        const idempotency = new MongoIdempotencyRepository(this.#database, session);
        const audit = new MongoPaymentAuditLog(this.#database, session);

        completion = {
          value: await operation({
            getOrderSnapshot: (merchantId, orderId) =>
              settlement.getOrderSnapshot(merchantId, orderId),
            reserveBalance: (merchantId, orderId, amount) =>
              settlement.reserveBalance(merchantId, orderId, amount),
            insertPayment: (payment) => payments.insert(payment),
            claimIdempotency: (record, now) =>
              idempotency.claim(record, now),
            completeIdempotency: (merchantId, op, key, outcome, response, now) =>
              idempotency.complete(merchantId, op, key, outcome, response, now),
            recordAudit: (event) => audit.record(event),
          }),
        };
      });
    } finally {
      await session.endSession();
    }

    if (completion === undefined) {
      throw new Error('Payment transaction completed without a result');
    }

    return completion.value;
  }
}

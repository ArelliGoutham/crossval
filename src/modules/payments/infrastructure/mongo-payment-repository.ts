import type { ClientSession, Collection, Db, WithId } from 'mongodb';

import type { PaymentRepository } from '@/modules/payments/domain/ports';
import type {
  NewStoredPayment,
  StoredPayment,
} from '@/modules/payments/domain/types';

type PaymentDocument = {
  id: string;
  merchantId: string;
  orderId: string;
  amountMinor: number;
  paymentDate: string;
  note: string | null;
  idempotencyKey: string;
  createdBy: string;
  createdAt: Date;
};

export class MongoPaymentRepository implements PaymentRepository {
  readonly #collection: Collection<PaymentDocument>;
  readonly #session: ClientSession | undefined;

  constructor(database: Db, session?: ClientSession) {
    this.#collection = database.collection<PaymentDocument>('payments');
    this.#session = session;
  }

  async insert(payment: NewStoredPayment): Promise<StoredPayment> {
    await this.#collection.insertOne(
      {
        id: payment.id,
        merchantId: payment.merchantId,
        orderId: payment.orderId,
        amountMinor: payment.amountMinor,
        paymentDate: payment.paymentDate,
        note: payment.note,
        idempotencyKey: payment.idempotencyKey,
        createdBy: payment.createdBy,
        createdAt: payment.createdAt,
      },
      { session: this.#session },
    );
    return { ...payment };
  }

  async listByOrderId(
    merchantId: string,
    orderId: string,
  ): Promise<readonly StoredPayment[]> {
    const cursor = this.#collection.find(
      { merchantId, orderId },
      { session: this.#session },
    );
    const documents = await cursor.toArray();
    return documents.map(toStoredPayment).sort((a, b) => {
      if (a.paymentDate !== b.paymentDate) {
        return a.paymentDate < b.paymentDate ? -1 : 1;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  async countByOrderId(merchantId: string, orderId: string): Promise<number> {
    return this.#collection.countDocuments(
      { merchantId, orderId },
      { session: this.#session },
    );
  }
}

function toStoredPayment(document: WithId<PaymentDocument>): StoredPayment {
  return {
    id: document.id,
    merchantId: document.merchantId,
    orderId: document.orderId,
    amountMinor: document.amountMinor,
    paymentDate: document.paymentDate,
    note: document.note,
    idempotencyKey: document.idempotencyKey,
    createdBy: document.createdBy,
    createdAt: document.createdAt,
  };
}

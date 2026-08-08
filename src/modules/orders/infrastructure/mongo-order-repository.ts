import type { ClientSession, Collection, Db, WithId } from 'mongodb';

import type { OrderRepository } from '@/modules/orders/domain/ports';
import type {
  NewStoredOrder,
  StoredLineItem,
  StoredOrder,
} from '@/modules/orders/domain/types';

type OrderDocument = {
  id: string;
  merchantId: string;
  customer: string;
  dueDate: string;
  lineItems: StoredLineItem[];
  subtotalMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  paymentCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export class MongoOrderRepository implements OrderRepository {
  readonly #collection: Collection<OrderDocument>;
  readonly #session: ClientSession | undefined;

  constructor(database: Db, session?: ClientSession) {
    this.#collection = database.collection<OrderDocument>('orders');
    this.#session = session;
  }

  async insert(order: NewStoredOrder): Promise<StoredOrder> {
    await this.#collection.insertOne(
      {
        id: order.id,
        merchantId: order.merchantId,
        customer: order.customer,
        dueDate: order.dueDate,
        lineItems: [...order.lineItems],
        subtotalMinor: order.subtotalMinor,
        totalMinor: order.totalMinor,
        amountPaidMinor: order.amountPaidMinor,
        paymentCount: order.paymentCount,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        deletedAt: null,
      },
      { session: this.#session },
    );

    return {
      ...order,
      deletedAt: null,
    };
  }

  async findById(
    merchantId: string,
    orderId: string,
  ): Promise<StoredOrder | null> {
    const document = await this.#collection.findOne(
      {
        id: orderId,
        merchantId,
        deletedAt: null,
      },
      { session: this.#session },
    );

    return document === null ? null : toStoredOrder(document);
  }

  async listActive(merchantId: string): Promise<readonly StoredOrder[]> {
    const cursor = this.#collection.find(
      { merchantId, deletedAt: null },
      { session: this.#session },
    );

    const documents = await cursor.toArray();
    return documents.map(toStoredOrder);
  }

  async update(
    merchantId: string,
    orderId: string,
    changes: {
      customer: string;
      dueDate: string;
      lineItems: readonly StoredLineItem[];
      subtotalMinor: number;
      totalMinor: number;
      updatedAt: Date;
    },
  ): Promise<StoredOrder | null> {
    const document = await this.#collection.findOneAndUpdate(
      {
        id: orderId,
        merchantId,
        deletedAt: null,
        paymentCount: 0,
      },
      {
        $set: {
          customer: changes.customer,
          dueDate: changes.dueDate,
          lineItems: [...changes.lineItems],
          subtotalMinor: changes.subtotalMinor,
          totalMinor: changes.totalMinor,
          updatedAt: changes.updatedAt,
        },
      },
      { returnDocument: 'after', session: this.#session },
    );

    return document === null ? null : toStoredOrder(document);
  }

  async softDelete(
    merchantId: string,
    orderId: string,
    deletedAt: Date,
  ): Promise<StoredOrder | null> {
    const document = await this.#collection.findOneAndUpdate(
      {
        id: orderId,
        merchantId,
        deletedAt: null,
        paymentCount: 0,
      },
      { $set: { deletedAt } },
      { returnDocument: 'after', session: this.#session },
    );

    return document === null ? null : toStoredOrder(document);
  }
}

function toStoredOrder(document: WithId<OrderDocument>): StoredOrder {
  return {
    id: document.id,
    merchantId: document.merchantId,
    customer: document.customer,
    dueDate: document.dueDate,
    lineItems: document.lineItems,
    subtotalMinor: document.subtotalMinor,
    totalMinor: document.totalMinor,
    amountPaidMinor: document.amountPaidMinor,
    paymentCount: document.paymentCount,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    deletedAt: document.deletedAt,
  };
}

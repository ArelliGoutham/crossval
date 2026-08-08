import type { ClientSession, Collection, Db } from 'mongodb';

import type {
  OrderSettlementPort,
  OrderSettlementSnapshot,
} from '@/modules/orders/domain/ports';

type OrderDocument = {
  id: string;
  merchantId: string;
  totalMinor: number;
  amountPaidMinor: number;
  paymentCount: number;
  dueDate: string;
  deletedAt: Date | null;
};

export class MongoOrderSettlementPort implements OrderSettlementPort {
  readonly #collection: Collection<OrderDocument>;
  readonly #session: ClientSession;

  constructor(database: Db, session: ClientSession) {
    this.#collection = database.collection<OrderDocument>('orders');
    this.#session = session;
  }

  async getOrderSnapshot(
    merchantId: string,
    orderId: string,
  ): Promise<OrderSettlementSnapshot | null> {
    const document = await this.#collection.findOne(
      { id: orderId, merchantId, deletedAt: null },
      { session: this.#session },
    );

    if (document === null) {
      return null;
    }

    return {
      totalMinor: document.totalMinor,
      amountPaidMinor: document.amountPaidMinor,
      dueDate: document.dueDate,
      paymentCount: document.paymentCount,
    };
  }

  async reserveBalance(
    merchantId: string,
    orderId: string,
    requestedAmountMinor: number,
  ): Promise<
    | { succeeded: true; amountPaidMinor: number; paymentCount: number }
    | { succeeded: false; maximumAllowedAmountMinor: number }
  > {
    const result = await this.#collection.findOneAndUpdate(
      {
        id: orderId,
        merchantId,
        deletedAt: null,
        $expr: {
          $lte: [
            { $add: ['$amountPaidMinor', requestedAmountMinor] },
            '$totalMinor',
          ],
        },
      },
      {
        $inc: {
          amountPaidMinor: requestedAmountMinor,
          paymentCount: 1,
        },
      },
      {
        returnDocument: 'after',
        session: this.#session,
      },
    );

    if (result === null) {
      const order = await this.#collection.findOne(
        { id: orderId, merchantId, deletedAt: null },
        { session: this.#session },
      );

      const maximumAllowedAmountMinor =
        order === null ? 0 : order.totalMinor - order.amountPaidMinor;

      return { succeeded: false, maximumAllowedAmountMinor };
    }

    return {
      succeeded: true,
      amountPaidMinor: result.amountPaidMinor,
      paymentCount: result.paymentCount,
    };
  }
}

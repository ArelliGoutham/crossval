import type { ClientSession, Collection, Db } from 'mongodb';

import type { AuditLog, OrderAuditEvent } from '@/modules/orders/domain/ports';

type OrderAuditDocument = {
  action: OrderAuditEvent['action'];
  occurredAt: Date;
  merchantId: string;
  orderId: string;
  actorId: string | null;
  changedFields: readonly string[];
};

export class MongoOrderAuditLog implements AuditLog {
  readonly #collection: Collection<OrderAuditDocument>;
  readonly #session: ClientSession | undefined;

  constructor(database: Db, session?: ClientSession) {
    this.#collection =
      database.collection<OrderAuditDocument>('orders_audit_log');
    this.#session = session;
  }

  async record(event: OrderAuditEvent): Promise<void> {
    await this.#collection.insertOne(
      {
        action: event.action,
        occurredAt: event.occurredAt,
        merchantId: event.merchantId,
        orderId: event.orderId,
        actorId: event.actorId,
        changedFields: [...event.changedFields],
      },
      { session: this.#session },
    );
  }
}

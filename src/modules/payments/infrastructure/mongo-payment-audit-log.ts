import type { ClientSession, Collection, Db } from 'mongodb';

import type { PaymentAuditEvent } from '@/modules/payments/domain/ports';

type PaymentAuditDocument = {
  action: PaymentAuditEvent['action'];
  occurredAt: Date;
  merchantId: string;
  orderId: string;
  paymentId: string | null;
  actorId: string;
  amountMinor: number;
  statusBefore: string;
  statusAfter: string;
  rejectionCode: string | null;
};

export class MongoPaymentAuditLog {
  readonly #collection: Collection<PaymentAuditDocument>;
  readonly #session: ClientSession | undefined;

  constructor(database: Db, session?: ClientSession) {
    this.#collection =
      database.collection<PaymentAuditDocument>('payments_audit_log');
    this.#session = session;
  }

  async record(event: PaymentAuditEvent): Promise<void> {
    await this.#collection.insertOne(
      {
        action: event.action,
        occurredAt: event.occurredAt,
        merchantId: event.merchantId,
        orderId: event.orderId,
        paymentId: event.paymentId,
        actorId: event.actorId,
        amountMinor: event.amountMinor,
        statusBefore: event.statusBefore,
        statusAfter: event.statusAfter,
        rejectionCode: event.rejectionCode,
      },
      { session: this.#session },
    );
  }
}

import type { Collection, Db } from 'mongodb';

import type {
  AuditLog,
  IdentityAuditEvent,
} from '@/modules/identity/domain/ports';

type IdentityAuditDocument = {
  action: IdentityAuditEvent['action'];
  occurredAt: Date;
  userId: string | null;
  merchantId: string | null;
};

export class MongoAuditLog implements AuditLog {
  readonly #collection: Collection<IdentityAuditDocument>;

  constructor(database: Db) {
    this.#collection = database.collection<IdentityAuditDocument>(
      'identity_audit_log',
    );
  }

  async record(event: IdentityAuditEvent): Promise<void> {
    await this.#collection.insertOne({
      action: event.action,
      occurredAt: event.occurredAt,
      userId: event.userId,
      merchantId: event.merchantId,
    });
  }
}

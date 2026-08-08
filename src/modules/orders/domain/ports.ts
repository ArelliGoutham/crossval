import type { NewStoredOrder, StoredOrder, StoredLineItem } from '@/modules/orders/domain/types';

export interface OrderRepository {
  insert(order: NewStoredOrder): Promise<StoredOrder>;
  findById(
    merchantId: string,
    orderId: string,
  ): Promise<StoredOrder | null>;
  listActive(merchantId: string): Promise<readonly StoredOrder[]>;
  update(
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
  ): Promise<StoredOrder | null>;
  softDelete(
    merchantId: string,
    orderId: string,
    deletedAt: Date,
  ): Promise<StoredOrder | null>;
}

export interface OrderSettlementPort {
  reserveBalance(
    merchantId: string,
    orderId: string,
    requestedAmountMinor: number,
  ): Promise<
    | { succeeded: true; amountPaidMinor: number; paymentCount: number }
    | { succeeded: false; maximumAllowedAmountMinor: number }
  >;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  generate(): string;
}

export interface AuditLog {
  record(event: OrderAuditEvent): Promise<void>;
}

export interface OrderAuditEvent {
  action:
    | 'orders.create.succeeded'
    | 'orders.update.succeeded'
    | 'orders.delete.succeeded';
  occurredAt: Date;
  merchantId: string;
  orderId: string;
  actorId: string | null;
  changedFields: readonly string[];
}

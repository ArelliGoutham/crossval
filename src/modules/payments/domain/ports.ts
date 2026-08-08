import type {
  OrderSettlementPort,
  OrderSettlementSnapshot,
} from '@/modules/orders/public';
import type {
  IdempotencyRecord,
  NewStoredPayment,
  StoredPayment,
} from '@/modules/payments/domain/types';

export interface PaymentRepository {
  insert(payment: NewStoredPayment): Promise<StoredPayment>;
  listByOrderId(
    merchantId: string,
    orderId: string,
  ): Promise<readonly StoredPayment[]>;
  countByOrderId(merchantId: string, orderId: string): Promise<number>;
}

export interface IdempotencyClaimResult {
  status: 'claimed' | 'completed' | 'conflict';
  record?: IdempotencyRecord;
}

export interface IdempotencyRepository {
  claim(
    record: {
      merchantId: string;
      operation: string;
      key: string;
      requestHash: string;
    },
    now: Date,
  ): Promise<IdempotencyClaimResult>;
  complete(
    merchantId: string,
    operation: string,
    key: string,
    outcome: 'succeeded' | 'rejected',
    response: Readonly<Record<string, unknown>>,
    now: Date,
  ): Promise<void>;
}

export interface PaymentTransaction {
  getOrderSnapshot(
    merchantId: string,
    orderId: string,
  ): Promise<OrderSettlementSnapshot | null>;
  reserveBalance(
    merchantId: string,
    orderId: string,
    requestedAmountMinor: number,
  ): ReturnType<OrderSettlementPort['reserveBalance']>;
  insertPayment(payment: NewStoredPayment): Promise<StoredPayment>;
  claimIdempotency(
    record: {
      merchantId: string;
      operation: string;
      key: string;
      requestHash: string;
    },
    now: Date,
  ): Promise<IdempotencyClaimResult>;
  completeIdempotency(
    merchantId: string,
    operation: string,
    key: string,
    outcome: 'succeeded' | 'rejected',
    response: Readonly<Record<string, unknown>>,
    now: Date,
  ): Promise<void>;
  recordAudit(event: PaymentAuditEvent): Promise<void>;
}

export interface PaymentTransactionRunner {
  run<T>(operation: (tx: PaymentTransaction) => Promise<T>): Promise<T>;
}

export interface PaymentReadClock {
  now(): Date;
}

export interface IdGenerator {
  generate(): string;
}

export interface PaymentAuditEvent {
  action: 'payments.record.succeeded' | 'payments.record.rejected';
  occurredAt: Date;
  merchantId: string;
  orderId: string;
  paymentId: string | null;
  actorId: string;
  amountMinor: number;
  statusBefore: string;
  statusAfter: string;
  rejectionCode: string | null;
}

import type {
  OrderSettlementPort,
  OrderSettlementSnapshot,
} from '@/modules/orders/public';
import type {
  IdGenerator,
  IdempotencyClaimResult,
  PaymentAuditEvent,
  PaymentReadClock,
  PaymentRepository,
  PaymentTransaction,
  PaymentTransactionRunner,
} from '@/modules/payments/domain/ports';
import type {
  IdempotencyRecord,
  NewStoredPayment,
  StoredPayment,
} from '@/modules/payments/domain/types';

type OrderState = {
  id: string;
  merchantId: string;
  totalMinor: number;
  amountPaidMinor: number;
  paymentCount: number;
  dueDate: string;
  deletedAt: Date | null;
};

export class InMemoryPaymentRepository implements PaymentRepository {
  readonly payments: StoredPayment[] = [];

  async insert(payment: NewStoredPayment): Promise<StoredPayment> {
    const stored: StoredPayment = { ...payment };
    this.payments.push(stored);
    return stored;
  }

  async listByOrderId(
    merchantId: string,
    orderId: string,
  ): Promise<readonly StoredPayment[]> {
    return this.payments
      .filter((p) => p.merchantId === merchantId && p.orderId === orderId)
      .sort((a, b) => {
        if (a.paymentDate !== b.paymentDate) {
          return a.paymentDate < b.paymentDate ? -1 : 1;
        }
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
  }

  async countByOrderId(merchantId: string, orderId: string): Promise<number> {
    return this.payments.filter(
      (p) => p.merchantId === merchantId && p.orderId === orderId,
    ).length;
  }
}

type IdempotencyState = {
  merchantId: string;
  operation: string;
  key: string;
  requestHash: string;
  outcome: 'succeeded' | 'rejected' | null;
  response: Readonly<Record<string, unknown>> | null;
  createdAt: Date;
  completedAt: Date | null;
};

export class InMemoryPaymentTransactionRunner implements PaymentTransactionRunner {
  readonly #payments: InMemoryPaymentRepository;
  readonly #auditEvents: PaymentAuditEvent[] = [];
  readonly #idempotency: IdempotencyState[] = [];
  readonly #orders: OrderState[];

  constructor(payments: InMemoryPaymentRepository, orders: OrderState[]) {
    this.#payments = payments;
    this.#orders = orders;
  }

  get auditEvents(): readonly PaymentAuditEvent[] {
    return this.#auditEvents;
  }

  async run<T>(operation: (tx: PaymentTransaction) => Promise<T>): Promise<T> {
    const orders = this.#orders;
    const payments = this.#payments;
    const idempotency = this.#idempotency;
    const auditEvents = this.#auditEvents;

    const tx: PaymentTransaction = {
      getOrderSnapshot: (merchantId, orderId) =>
        getOrderSnapshot(orders, merchantId, orderId),
      reserveBalance: (merchantId, orderId, amount) =>
        reserveBalance(orders, merchantId, orderId, amount),
      insertPayment: (payment) => payments.insert(payment),
      claimIdempotency: (record, now) =>
        claimIdempotency(idempotency, record, now),
      completeIdempotency: (
        merchantId,
        operation,
        key,
        outcome,
        response,
        now,
      ) =>
        completeIdempotency(
          idempotency,
          merchantId,
          operation,
          key,
          outcome,
          response,
          now,
        ),
      recordAudit: (event) => {
        auditEvents.push(event);
        return Promise.resolve();
      },
    };

    return operation(tx);
  }
}

function getOrderSnapshot(
  orders: OrderState[],
  merchantId: string,
  orderId: string,
): Promise<OrderSettlementSnapshot | null> {
  const order = orders.find(
    (o) =>
      o.id === orderId && o.merchantId === merchantId && o.deletedAt === null,
  );
  if (order === undefined) {
    return Promise.resolve(null);
  }
  return Promise.resolve({
    totalMinor: order.totalMinor,
    amountPaidMinor: order.amountPaidMinor,
    dueDate: order.dueDate,
    paymentCount: order.paymentCount,
  });
}

function reserveBalance(
  orders: OrderState[],
  merchantId: string,
  orderId: string,
  requestedAmountMinor: number,
): ReturnType<OrderSettlementPort['reserveBalance']> {
  const order = orders.find(
    (o) =>
      o.id === orderId && o.merchantId === merchantId && o.deletedAt === null,
  );

  if (order === undefined) {
    return Promise.resolve({ succeeded: false, maximumAllowedAmountMinor: 0 });
  }

  if (order.amountPaidMinor + requestedAmountMinor > order.totalMinor) {
    return Promise.resolve({
      succeeded: false,
      maximumAllowedAmountMinor: order.totalMinor - order.amountPaidMinor,
    });
  }

  order.amountPaidMinor += requestedAmountMinor;
  order.paymentCount += 1;

  return Promise.resolve({
    succeeded: true,
    amountPaidMinor: order.amountPaidMinor,
    paymentCount: order.paymentCount,
  });
}

function claimIdempotency(
  idempotency: IdempotencyState[],
  record: {
    merchantId: string;
    operation: string;
    key: string;
    requestHash: string;
  },
  now: Date,
): Promise<IdempotencyClaimResult> {
  const existing = idempotency.find(
    (r) =>
      r.merchantId === record.merchantId &&
      r.operation === record.operation &&
      r.key === record.key,
  );

  if (existing !== undefined) {
    if (existing.requestHash !== record.requestHash) {
      return Promise.resolve({ status: 'conflict' });
    }
    if (existing.outcome !== null) {
      const completedRecord: IdempotencyRecord = {
        merchantId: existing.merchantId,
        operation: existing.operation,
        key: existing.key,
        requestHash: existing.requestHash,
        outcome: existing.outcome,
        response: existing.response ?? {},
        createdAt: existing.createdAt,
        completedAt: existing.completedAt ?? now,
      };
      return Promise.resolve({
        status: 'completed',
        record: completedRecord,
      });
    }
    return Promise.resolve({ status: 'claimed' });
  }

  idempotency.push({
    merchantId: record.merchantId,
    operation: record.operation,
    key: record.key,
    requestHash: record.requestHash,
    outcome: null,
    response: null,
    createdAt: now,
    completedAt: null,
  });

  return Promise.resolve({ status: 'claimed' });
}

function completeIdempotency(
  idempotency: IdempotencyState[],
  merchantId: string,
  operation: string,
  key: string,
  outcome: 'succeeded' | 'rejected',
  response: Readonly<Record<string, unknown>>,
  now: Date,
): Promise<void> {
  const record = idempotency.find(
    (r) =>
      r.merchantId === merchantId && r.operation === operation && r.key === key,
  );

  if (record !== undefined) {
    record.outcome = outcome;
    record.response = response;
    record.completedAt = now;
  }

  return Promise.resolve();
}

export function seedOrder(
  id: string,
  merchantId: string,
  totalMinor: number,
  dueDate = '2026-08-15',
): OrderState {
  return {
    id,
    merchantId,
    totalMinor,
    amountPaidMinor: 0,
    paymentCount: 0,
    dueDate,
    deletedAt: null,
  };
}

export class FixedClock implements PaymentReadClock {
  #value: Date;

  constructor(value: Date) {
    this.#value = value;
  }

  now(): Date {
    return this.#value;
  }

  set(value: Date): void {
    this.#value = value;
  }
}

export class StubIdGenerator implements IdGenerator {
  readonly #ids: string[];
  #index = 0;

  constructor(ids: string[]) {
    this.#ids = ids;
  }

  generate(): string {
    const id = this.#ids[this.#index];
    if (id === undefined) {
      throw new Error('No identifier available');
    }
    this.#index += 1;
    return id;
  }
}

import type {
  AuditLog,
  Clock,
  IdGenerator,
  OrderAuditEvent,
  OrderRepository,
} from '@/modules/orders/domain/ports';
import type {
  NewStoredOrder,
  StoredOrder,
  StoredLineItem,
} from '@/modules/orders/domain/types';

export class InMemoryOrderRepository implements OrderRepository {
  readonly orders: StoredOrder[] = [];

  async insert(order: NewStoredOrder): Promise<StoredOrder> {
    const stored: StoredOrder = { ...order, deletedAt: null };
    this.orders.push(stored);
    return stored;
  }

  async findById(
    merchantId: string,
    orderId: string,
  ): Promise<StoredOrder | null> {
    return (
      this.orders.find(
        (order) =>
          order.id === orderId &&
          order.merchantId === merchantId &&
          order.deletedAt === null,
      ) ?? null
    );
  }

  async listActive(merchantId: string): Promise<readonly StoredOrder[]> {
    return this.orders.filter(
      (order) => order.merchantId === merchantId && order.deletedAt === null,
    );
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
    const index = this.orders.findIndex(
      (o) =>
        o.id === orderId &&
        o.merchantId === merchantId &&
        o.deletedAt === null &&
        o.paymentCount === 0,
    );

    if (index === -1) {
      return null;
    }

    const updated: StoredOrder = {
      ...this.orders[index]!,
      customer: changes.customer,
      dueDate: changes.dueDate,
      lineItems: changes.lineItems,
      subtotalMinor: changes.subtotalMinor,
      totalMinor: changes.totalMinor,
      updatedAt: changes.updatedAt,
    };
    this.orders[index] = updated;
    return { ...updated };
  }

  async softDelete(
    merchantId: string,
    orderId: string,
    deletedAt: Date,
  ): Promise<StoredOrder | null> {
    const index = this.orders.findIndex(
      (o) =>
        o.id === orderId &&
        o.merchantId === merchantId &&
        o.deletedAt === null &&
        o.paymentCount === 0,
    );

    if (index === -1) {
      return null;
    }

    const deleted: StoredOrder = { ...this.orders[index]!, deletedAt };
    this.orders[index] = deleted;
    return { ...deleted };
  }
}

export class InMemoryAuditLog implements AuditLog {
  readonly events: OrderAuditEvent[] = [];

  async record(event: OrderAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

export class FixedClock implements Clock {
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

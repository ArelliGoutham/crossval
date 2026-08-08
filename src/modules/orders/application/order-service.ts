import { OrderError } from '@/modules/orders/domain/errors';
import type {
  AuditLog,
  Clock,
  IdGenerator,
  OrderRepository,
} from '@/modules/orders/domain/ports';
import {
  createOrderInputSchema,
  listOrdersQuerySchema,
  updateOrderInputSchema,
  type CreateOrderInput,
  type ListOrdersQuery,
  type UpdateOrderInput,
} from '@/modules/orders/domain/schemas';
import {
  computeLineTotal,
  computeSubtotal,
} from '@/modules/orders/domain/totals';
import type { AuthenticatedMerchant } from '@/modules/identity/public';
import type {
  OrderResult,
  OrderSummary,
  StoredLineItem,
  StoredOrder,
  NewStoredOrder,
} from '@/modules/orders/domain/types';
import { evaluateSettlement } from '@/modules/order-status/public';

const NOT_FOUND_ERROR = new OrderError('not_found');

type OrderServiceDependencies = {
  orders: OrderRepository;
  audit: AuditLog;
  clock: Clock;
  ids: IdGenerator;
};

export class OrderService {
  readonly #orders: OrderRepository;
  readonly #audit: AuditLog;
  readonly #clock: Clock;
  readonly #ids: IdGenerator;

  constructor(dependencies: OrderServiceDependencies) {
    this.#orders = dependencies.orders;
    this.#audit = dependencies.audit;
    this.#clock = dependencies.clock;
    this.#ids = dependencies.ids;
  }

  async createOrder(
    merchant: AuthenticatedMerchant,
    input: CreateOrderInput,
  ): Promise<OrderResult> {
    const validated = createOrderInputSchema.parse(input);
    const now = this.#clock.now();

    const lineItems: StoredLineItem[] = validated.lineItems.map((item) => ({
      id: this.#ids.generate(),
      description: item.description,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      lineTotalMinor: computeLineTotal(item.quantity, item.unitPriceMinor),
    }));

    const subtotalMinor = computeSubtotal(
      lineItems.map((item) => item.lineTotalMinor),
    );

    const order: NewStoredOrder = {
      id: this.#ids.generate(),
      merchantId: merchant.merchantId,
      customer: validated.customer,
      dueDate: validated.dueDate,
      lineItems,
      subtotalMinor,
      totalMinor: subtotalMinor,
      amountPaidMinor: 0,
      paymentCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const stored = await this.#orders.insert(order);

    await this.#audit.record({
      action: 'orders.create.succeeded',
      occurredAt: now,
      merchantId: merchant.merchantId,
      orderId: stored.id,
      actorId: merchant.userId,
      changedFields: [],
    });

    return this.#toOrderResult(stored);
  }

  async listOrders(
    merchant: AuthenticatedMerchant,
    query: ListOrdersQuery,
  ): Promise<readonly OrderSummary[]> {
    const validated = listOrdersQuerySchema.parse(query);
    const orders = await this.#orders.listActive(merchant.merchantId);

    const summaries = orders.map((order) => this.#toOrderSummary(order));

    if (validated.status === undefined) {
      return summaries;
    }

    return summaries.filter((summary) => summary.status === validated.status);
  }

  async getOrder(
    merchant: AuthenticatedMerchant,
    orderId: string,
  ): Promise<OrderResult> {
    const order = await this.#orders.findById(merchant.merchantId, orderId);

    if (order === null) {
      throw NOT_FOUND_ERROR;
    }

    return this.#toOrderResult(order);
  }

  async updateOrder(
    merchant: AuthenticatedMerchant,
    orderId: string,
    input: UpdateOrderInput,
  ): Promise<OrderResult> {
    const validated = updateOrderInputSchema.parse(input);
    const order = await this.#orders.findById(merchant.merchantId, orderId);

    if (order === null) {
      throw NOT_FOUND_ERROR;
    }

    if (order.paymentCount > 0) {
      throw new OrderError('payment_locked');
    }

    const now = this.#clock.now();
    const customer = validated.customer ?? order.customer;
    const dueDate = validated.dueDate ?? order.dueDate;
    const changedFields: string[] = [];
    if (validated.customer !== undefined) {
      changedFields.push('customer');
    }
    if (validated.dueDate !== undefined) {
      changedFields.push('dueDate');
    }

    let lineItems = order.lineItems;
    let subtotalMinor = order.subtotalMinor;
    let totalMinor = order.totalMinor;

    if (validated.lineItems !== undefined) {
      lineItems = validated.lineItems.map((item) => ({
        id: this.#ids.generate(),
        description: item.description,
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor,
        lineTotalMinor: computeLineTotal(item.quantity, item.unitPriceMinor),
      }));
      subtotalMinor = computeSubtotal(
        lineItems.map((item) => item.lineTotalMinor),
      );
      totalMinor = subtotalMinor;
      changedFields.push('lineItems');
    }

    const updated = await this.#orders.update(merchant.merchantId, orderId, {
      customer,
      dueDate,
      lineItems,
      subtotalMinor,
      totalMinor,
      updatedAt: now,
    });

    if (updated === null) {
      throw new OrderError('payment_locked');
    }

    await this.#audit.record({
      action: 'orders.update.succeeded',
      occurredAt: now,
      merchantId: merchant.merchantId,
      orderId: updated.id,
      actorId: merchant.userId,
      changedFields,
    });

    return this.#toOrderResult(updated);
  }

  async deleteOrder(
    merchant: AuthenticatedMerchant,
    orderId: string,
  ): Promise<void> {
    const order = await this.#orders.findById(merchant.merchantId, orderId);

    if (order === null) {
      throw NOT_FOUND_ERROR;
    }

    if (order.paymentCount > 0) {
      throw new OrderError('payment_locked');
    }

    const now = this.#clock.now();
    const deleted = await this.#orders.softDelete(
      merchant.merchantId,
      orderId,
      now,
    );

    if (deleted === null) {
      throw new OrderError('payment_locked');
    }

    await this.#audit.record({
      action: 'orders.delete.succeeded',
      occurredAt: now,
      merchantId: merchant.merchantId,
      orderId: deleted.id,
      actorId: merchant.userId,
      changedFields: [],
    });
  }

  #toOrderResult(order: StoredOrder): OrderResult {
    const settlement = evaluateSettlement({
      totalMinor: order.totalMinor,
      amountPaidMinor: order.amountPaidMinor,
      dueDate: order.dueDate,
      asOfUtcDate: toUtcDateString(this.#clock.now()),
    });

    return {
      id: order.id,
      customer: order.customer,
      dueDate: order.dueDate,
      lineItems: order.lineItems,
      subtotalMinor: order.subtotalMinor,
      totalMinor: order.totalMinor,
      amountPaidMinor: order.amountPaidMinor,
      amountDueMinor: settlement.amountDueMinor,
      status: settlement.status,
      paymentCount: order.paymentCount,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  #toOrderSummary(order: StoredOrder): OrderSummary {
    const settlement = evaluateSettlement({
      totalMinor: order.totalMinor,
      amountPaidMinor: order.amountPaidMinor,
      dueDate: order.dueDate,
      asOfUtcDate: toUtcDateString(this.#clock.now()),
    });

    return {
      id: order.id,
      customer: order.customer,
      dueDate: order.dueDate,
      totalMinor: order.totalMinor,
      amountPaidMinor: order.amountPaidMinor,
      amountDueMinor: settlement.amountDueMinor,
      status: settlement.status,
      paymentCount: order.paymentCount,
    };
  }
}

function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

import { describe, expect, test } from 'vitest';

import { OrderService } from '@/modules/orders/application/order-service';
import { OrderError } from '@/modules/orders/domain/errors';
import {
  FixedClock,
  InMemoryAuditLog,
  InMemoryOrderRepository,
  StubIdGenerator,
} from '@/modules/orders/application/test-doubles';
import type { AuthenticatedMerchant } from '@/modules/identity/public';

const MERCHANT: AuthenticatedMerchant = {
  userId: 'user-1',
  merchantId: 'merchant-1',
};

const OTHER_MERCHANT: AuthenticatedMerchant = {
  userId: 'user-2',
  merchantId: 'merchant-2',
};

const NOW = new Date('2026-08-08T10:00:00.000Z');

function createService() {
  const orders = new InMemoryOrderRepository();
  const audit = new InMemoryAuditLog();
  const clock = new FixedClock(NOW);
  const ids = new StubIdGenerator([
    'order-1',
    'line-1',
    'line-2',
    'order-2',
    'line-3',
    'order-locked',
  ]);

  const service = new OrderService({
    orders,
    audit,
    clock,
    ids,
  });

  return { service, orders, audit, clock, ids };
}

describe('OrderService.createOrder', () => {
  test('creates an order with server-computed totals', async () => {
    const { service, orders, audit } = createService();

    const result = await service.createOrder(MERCHANT, {
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    expect(result.totalMinor).toBe(100000);
    expect(result.subtotalMinor).toBe(100000);
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]?.lineTotalMinor).toBe(100000);
    expect(result.amountPaidMinor).toBe(0);
    expect(result.paymentCount).toBe(0);
    expect(result.amountDueMinor).toBe(100000);
    expect(result.status).toBe('pending');
    expect(orders.orders).toHaveLength(1);
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.action).toBe('orders.create.succeeded');
  });

  test('computes totals across multiple line items', async () => {
    const { service } = createService();

    const result = await service.createOrder(MERCHANT, {
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
        { description: 'Gadget', quantity: 1, unitPriceMinor: 25000 },
      ],
    });

    expect(result.subtotalMinor).toBe(125000);
    expect(result.totalMinor).toBe(125000);
  });
});

describe('OrderService.getOrder', () => {
  test('returns an order with derived status', async () => {
    const { service } = createService();

    const created = await service.createOrder(MERCHANT, {
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    const result = await service.getOrder(MERCHANT, created.id);

    expect(result.id).toBe(created.id);
    expect(result.status).toBe('pending');
  });

  test("throws not_found for another merchant's order", async () => {
    const { service } = createService();

    const created = await service.createOrder(MERCHANT, {
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    await expect(
      service.getOrder(OTHER_MERCHANT, created.id),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  test('throws not_found for a non-existent order', async () => {
    const { service } = createService();

    await expect(
      service.getOrder(MERCHANT, 'nonexistent'),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('OrderService.listOrders', () => {
  test('returns only active orders for the current merchant', async () => {
    const { service } = createService();

    await service.createOrder(MERCHANT, {
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    await service.createOrder(OTHER_MERCHANT, {
      customer: 'Other Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 1, unitPriceMinor: 50000 },
      ],
    });

    const result = await service.listOrders(MERCHANT, {});

    expect(result).toHaveLength(1);
    expect(result[0]?.customer).toBe('Acme Corp');
  });
});

describe('OrderService.updateOrder', () => {
  test('updates an order with paymentCount zero', async () => {
    const { service, audit } = createService();

    const created = await service.createOrder(MERCHANT, {
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    const result = await service.updateOrder(MERCHANT, created.id, {
      customer: 'Updated Corp',
    });

    expect(result.customer).toBe('Updated Corp');
    expect(audit.events).toContainEqual(
      expect.objectContaining({
        action: 'orders.update.succeeded',
        changedFields: ['customer'],
      }),
    );
  });

  test('throws payment_locked for an order with payments', async () => {
    const orders = new InMemoryOrderRepository();
    const audit = new InMemoryAuditLog();
    const service = new OrderService({
      orders,
      audit,
      clock: new FixedClock(NOW),
      ids: new StubIdGenerator(['order-locked', 'line-1']),
    });
    const locked = await service.createOrder(MERCHANT, {
      customer: 'Locked Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 1, unitPriceMinor: 50000 },
      ],
    });

    (orders.orders[0] as { paymentCount: number }).paymentCount = 1;

    await expect(
      service.updateOrder(MERCHANT, locked.id, {
        customer: 'Updated',
      }),
    ).rejects.toMatchObject({ code: 'payment_locked' });
  });

  test("throws not_found for another merchant's order", async () => {
    const { service } = createService();

    const created = await service.createOrder(MERCHANT, {
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    await expect(
      service.updateOrder(OTHER_MERCHANT, created.id, {
        customer: 'Hacked',
      }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('OrderService.deleteOrder', () => {
  test('soft-deletes an order with paymentCount zero', async () => {
    const { service, orders, audit } = createService();

    const created = await service.createOrder(MERCHANT, {
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    await service.deleteOrder(MERCHANT, created.id);

    expect(orders.orders[0]?.deletedAt).toEqual(NOW);
    expect(audit.events).toContainEqual(
      expect.objectContaining({
        action: 'orders.delete.succeeded',
      }),
    );
  });

  test('soft-deleted order is absent from list and detail', async () => {
    const { service } = createService();

    const created = await service.createOrder(MERCHANT, {
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    await service.deleteOrder(MERCHANT, created.id);

    await expect(service.getOrder(MERCHANT, created.id)).rejects.toMatchObject({
      code: 'not_found',
    });
    const list = await service.listOrders(MERCHANT, {});
    expect(list).toHaveLength(0);
  });

  test('throws payment_locked for an order with payments', async () => {
    const { service, orders } = createService();

    const created = await service.createOrder(MERCHANT, {
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    (orders.orders[0] as { paymentCount: number }).paymentCount = 1;

    await expect(
      service.deleteOrder(MERCHANT, created.id),
    ).rejects.toMatchObject({ code: 'payment_locked' });
  });
});

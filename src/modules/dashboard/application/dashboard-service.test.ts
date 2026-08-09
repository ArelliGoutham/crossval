import { describe, expect, test } from 'vitest';

import { DashboardService } from '@/modules/dashboard/application/dashboard-service';
import type { AuthenticatedMerchant } from '@/modules/identity/public';
import type { OrderResult, OrderSummary } from '@/modules/orders/public';
import type { PaymentListItem } from '@/modules/payments/public';

const MERCHANT: AuthenticatedMerchant = {
  userId: 'user-1',
  merchantId: 'merchant-1',
};

const OTHER_MERCHANT: AuthenticatedMerchant = {
  userId: 'user-2',
  merchantId: 'merchant-2',
};

function makeOrderSummary(
  id: string,
  overrides: Partial<OrderSummary> = {},
): OrderSummary {
  return {
    id,
    customer: 'Acme Corp',
    dueDate: '2026-08-15',
    totalMinor: 100000,
    amountPaidMinor: 0,
    amountDueMinor: 100000,
    status: 'pending',
    paymentCount: 0,
    ...overrides,
  };
}

function makeOrderResult(
  id: string,
  overrides: Partial<OrderResult> = {},
): OrderResult {
  return {
    id,
    customer: 'Acme Corp',
    dueDate: '2026-08-15',
    lineItems: [
      {
        id: 'line-1',
        description: 'Widget',
        quantity: 2,
        unitPriceMinor: 50000,
        lineTotalMinor: 100000,
      },
    ],
    subtotalMinor: 100000,
    totalMinor: 100000,
    amountPaidMinor: 0,
    amountDueMinor: 100000,
    status: 'pending',
    paymentCount: 0,
    createdAt: new Date('2026-08-08T10:00:00.000Z'),
    updatedAt: new Date('2026-08-08T10:00:00.000Z'),
    ...overrides,
  };
}

function makePayment(
  id: string,
  overrides: Partial<PaymentListItem> = {},
): PaymentListItem {
  return {
    id,
    orderId: 'order-1',
    amountMinor: 40000,
    paymentDate: '2026-08-08',
    note: null,
    createdBy: 'user-1',
    createdAt: new Date('2026-08-08T10:00:00.000Z'),
    ...overrides,
  };
}

function createService(
  orders: readonly OrderSummary[],
  orderResult: OrderResult | null = null,
  payments: readonly PaymentListItem[] = [],
) {
  const ordersService = {
    listOrders: async (): Promise<readonly OrderSummary[]> => orders,
    getOrder: async (): Promise<OrderResult> => {
      if (orderResult === null) {
        throw { code: 'not_found' };
      }
      return orderResult;
    },
  };

  const paymentsService = {
    listPayments: async (): Promise<readonly PaymentListItem[]> => payments,
  };

  return new DashboardService({
    orders: ordersService as never,
    payments: paymentsService as never,
  });
}

describe('DashboardService.getDashboardOrders', () => {
  test('returns rows with exact total, paid, due, and status', async () => {
    const service = createService([
      makeOrderSummary('order-1', {
        totalMinor: 100000,
        amountPaidMinor: 40000,
        amountDueMinor: 60000,
        status: 'partially_paid',
      }),
    ]);

    const rows = await service.getDashboardOrders(MERCHANT, {});

    expect(rows).toHaveLength(1);
    expect(rows[0]?.totalMinor).toBe(100000);
    expect(rows[0]?.amountPaidMinor).toBe(40000);
    expect(rows[0]?.amountDueMinor).toBe(60000);
    expect(rows[0]?.status).toBe('partially_paid');
  });

  test('filters by status', async () => {
    const service = createService([
      makeOrderSummary('order-1', { status: 'pending' }),
      makeOrderSummary('order-2', { status: 'paid' }),
      makeOrderSummary('order-3', { status: 'pending' }),
    ]);

    const pending = await service.getDashboardOrders(MERCHANT, {
      status: 'pending',
    });
    expect(pending).toHaveLength(2);
    expect(pending.every((r) => r.status === 'pending')).toBe(true);

    const paid = await service.getDashboardOrders(MERCHANT, {
      status: 'paid',
    });
    expect(paid).toHaveLength(1);
    expect(paid[0]?.id).toBe('order-2');
  });

  test('returns all rows when no filter', async () => {
    const service = createService([
      makeOrderSummary('order-1', { status: 'pending' }),
      makeOrderSummary('order-2', { status: 'paid' }),
    ]);

    const rows = await service.getDashboardOrders(MERCHANT, {});
    expect(rows).toHaveLength(2);
  });

  test('returns empty array for merchant with no orders', async () => {
    const service = createService([]);

    const rows = await service.getDashboardOrders(MERCHANT, {});
    expect(rows).toEqual([]);
  });
});

describe('DashboardService.getOrderDetail', () => {
  test('returns order with line items and payment history', async () => {
    const service = createService(
      [],
      makeOrderResult('order-1', {
        amountPaidMinor: 40000,
        amountDueMinor: 60000,
        status: 'partially_paid',
        paymentCount: 1,
      }),
      [makePayment('pay-1')],
    );

    const detail = await service.getOrderDetail(MERCHANT, 'order-1');

    expect(detail.id).toBe('order-1');
    expect(detail.lineItems).toHaveLength(1);
    expect(detail.payments).toHaveLength(1);
    expect(detail.payments[0]?.amountMinor).toBe(40000);
    expect(detail.amountDueMinor).toBe(60000);
    expect(detail.status).toBe('partially_paid');
  });

  test('throws not_found for inaccessible order', async () => {
    const service = createService([], null, []);

    await expect(
      service.getOrderDetail(OTHER_MERCHANT, 'order-1'),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  test('returns empty payment history for order with no payments', async () => {
    const service = createService(
      [],
      makeOrderResult('order-1', { paymentCount: 0 }),
      [],
    );

    const detail = await service.getOrderDetail(MERCHANT, 'order-1');
    expect(detail.payments).toEqual([]);
  });
});

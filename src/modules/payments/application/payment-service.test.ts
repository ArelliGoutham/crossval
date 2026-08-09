import { describe, expect, test } from 'vitest';

import { PaymentService } from '@/modules/payments/application/payment-service';
import { PaymentError } from '@/modules/payments/domain/errors';
import {
  FixedClock,
  InMemoryPaymentRepository,
  InMemoryPaymentTransactionRunner,
  StubIdGenerator,
  seedOrder,
} from '@/modules/payments/application/test-doubles';
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

function createService(orderTotalMinor = 100000) {
  const payments = new InMemoryPaymentRepository();
  const order = seedOrder('order-1', 'merchant-1', orderTotalMinor);
  const runner = new InMemoryPaymentTransactionRunner(payments, [order]);
  const clock = new FixedClock(NOW);
  const ids = new StubIdGenerator(['payment-1', 'payment-2', 'payment-3']);

  const service = new PaymentService({
    payments,
    transactions: runner,
    clock,
    ids,
  });

  return { service, payments, order, runner, clock, ids };
}

describe('PaymentService.recordPayment', () => {
  test('records a partial payment and updates order summary', async () => {
    const { service, payments, runner } = createService();

    const { result, replayed, httpStatus } = await service.recordPayment(
      MERCHANT,
      'order-1',
      { amountMinor: 40000, paymentDate: '2026-08-08', note: null },
      'key-1',
    );

    expect(httpStatus).toBe(201);
    expect(replayed).toBe(false);
    expect(result.amountMinor).toBe(40000);
    expect(result.statusBefore).toBe('pending');
    expect(result.statusAfter).toBe('partially_paid');
    expect(result.amountDueMinorAfter).toBe(60000);
    expect(payments.payments).toHaveLength(1);
    expect(runner.auditEvents).toHaveLength(1);
    expect(runner.auditEvents[0]?.action).toBe('payments.record.succeeded');
    expect(runner.auditEvents[0]?.amountMinor).toBe(40000);
  });

  test('assignment scenario: $400 then $600 reaches paid', async () => {
    const { service, payments } = createService(100000);

    const first = await service.recordPayment(
      MERCHANT,
      'order-1',
      { amountMinor: 40000, paymentDate: '2026-08-08', note: null },
      'key-1',
    );
    expect(first.result.statusAfter).toBe('partially_paid');
    expect(first.result.amountDueMinorAfter).toBe(60000);

    const second = await service.recordPayment(
      MERCHANT,
      'order-1',
      { amountMinor: 60000, paymentDate: '2026-08-08', note: null },
      'key-2',
    );
    expect(second.result.statusAfter).toBe('paid');
    expect(second.result.amountDueMinorAfter).toBe(0);
    expect(payments.payments).toHaveLength(2);
  });

  test('over-payment returns error with maximum allowed and creates no payment', async () => {
    const { service, payments, runner } = createService(100000);

    await service.recordPayment(
      MERCHANT,
      'order-1',
      { amountMinor: 60000, paymentDate: '2026-08-08', note: null },
      'key-1',
    );

    await expect(
      service.recordPayment(
        MERCHANT,
        'order-1',
        { amountMinor: 50000, paymentDate: '2026-08-08', note: null },
        'key-2',
      ),
    ).rejects.toMatchObject({
      code: 'overpayment',
      details: { maximumAllowedAmountMinor: 40000 },
    });

    expect(payments.payments).toHaveLength(1);
    expect(runner.auditEvents).toHaveLength(2);
    expect(runner.auditEvents[1]?.action).toBe('payments.record.rejected');
    expect(runner.auditEvents[1]?.rejectionCode).toBe('OVERPAYMENT');
  });

  test('assignment over-payment: $1 after full payment is rejected', async () => {
    const { service, payments } = createService(100000);

    await service.recordPayment(
      MERCHANT,
      'order-1',
      { amountMinor: 40000, paymentDate: '2026-08-08', note: null },
      'key-1',
    );
    await service.recordPayment(
      MERCHANT,
      'order-1',
      { amountMinor: 60000, paymentDate: '2026-08-08', note: null },
      'key-2',
    );

    await expect(
      service.recordPayment(
        MERCHANT,
        'order-1',
        { amountMinor: 100, paymentDate: '2026-08-08', note: null },
        'key-3',
      ),
    ).rejects.toMatchObject({
      code: 'overpayment',
      details: { maximumAllowedAmountMinor: 0 },
    });

    expect(payments.payments).toHaveLength(2);
  });

  test('repeated idempotency key with same request replays original', async () => {
    const { service, payments } = createService();

    const first = await service.recordPayment(
      MERCHANT,
      'order-1',
      { amountMinor: 40000, paymentDate: '2026-08-08', note: null },
      'key-1',
    );

    const second = await service.recordPayment(
      MERCHANT,
      'order-1',
      { amountMinor: 40000, paymentDate: '2026-08-08', note: null },
      'key-1',
    );

    expect(second.replayed).toBe(true);
    expect(second.httpStatus).toBe(200);
    expect(second.result.amountMinor).toBe(first.result.amountMinor);
    expect(payments.payments).toHaveLength(1);
  });

  test('same key with different request returns idempotency_key_reused', async () => {
    const { service } = createService();

    await service.recordPayment(
      MERCHANT,
      'order-1',
      { amountMinor: 40000, paymentDate: '2026-08-08', note: null },
      'key-1',
    );

    await expect(
      service.recordPayment(
        MERCHANT,
        'order-1',
        { amountMinor: 60000, paymentDate: '2026-08-08', note: null },
        'key-1',
      ),
    ).rejects.toMatchObject({ code: 'idempotency_key_reused' });
  });

  test('cross-merchant order returns order_not_found', async () => {
    const { service } = createService();

    await expect(
      service.recordPayment(
        OTHER_MERCHANT,
        'order-1',
        { amountMinor: 40000, paymentDate: '2026-08-08', note: null },
        'key-1',
      ),
    ).rejects.toMatchObject({ code: 'order_not_found' });
  });

  test('records a payment with a note', async () => {
    const { service, payments } = createService();

    await service.recordPayment(
      MERCHANT,
      'order-1',
      {
        amountMinor: 40000,
        paymentDate: '2026-08-08',
        note: 'First installment',
      },
      'key-1',
    );

    expect(payments.payments[0]?.note).toBe('First installment');
  });

  test('order not found returns order_not_found error', async () => {
    const { service } = createService();

    await expect(
      service.recordPayment(
        MERCHANT,
        'nonexistent',
        { amountMinor: 40000, paymentDate: '2026-08-08', note: null },
        'key-1',
      ),
    ).rejects.toMatchObject({ code: 'order_not_found' });
  });
});

describe('PaymentService.listPayments', () => {
  test('lists payments ordered by date then creation', async () => {
    const { service } = createService();

    const p1 = await service.recordPayment(
      MERCHANT,
      'order-1',
      { amountMinor: 40000, paymentDate: '2026-08-08', note: null },
      'key-1',
    );
    const p2 = await service.recordPayment(
      MERCHANT,
      'order-1',
      { amountMinor: 60000, paymentDate: '2026-08-08', note: null },
      'key-2',
    );

    const list = await service.listPayments(MERCHANT, 'order-1');
    expect(list).toHaveLength(2);
    expect(list[0]?.id).toBe(p1.result.id);
    expect(list[1]?.id).toBe(p2.result.id);
  });

  test('cross-merchant list returns empty', async () => {
    const { service } = createService();

    await service.recordPayment(
      MERCHANT,
      'order-1',
      { amountMinor: 40000, paymentDate: '2026-08-08', note: null },
      'key-1',
    );

    const list = await service.listPayments(OTHER_MERCHANT, 'order-1');
    expect(list).toHaveLength(0);
  });
});

describe('PaymentService.hasPayments', () => {
  test('returns false before any payment', async () => {
    const { service } = createService();
    expect(await service.hasPayments('merchant-1', 'order-1')).toBe(false);
  });

  test('returns true after a payment', async () => {
    const { service } = createService();

    await service.recordPayment(
      MERCHANT,
      'order-1',
      { amountMinor: 40000, paymentDate: '2026-08-08', note: null },
      'key-1',
    );

    expect(await service.hasPayments('merchant-1', 'order-1')).toBe(true);
  });
});

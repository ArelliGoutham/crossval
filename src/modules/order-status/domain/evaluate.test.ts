import { describe, expect, test } from 'vitest';

import { evaluateSettlement } from '@/modules/order-status/domain/evaluate';

describe('evaluateSettlement', () => {
  test('no payments on or before due date returns pending', () => {
    const result = evaluateSettlement({
      totalMinor: 100000,
      amountPaidMinor: 0,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-08',
    });

    expect(result).toEqual({
      status: 'pending',
      amountDueMinor: 100000,
      isOverdue: false,
    });
  });

  test('partial payments on or before due date return partially_paid', () => {
    const result = evaluateSettlement({
      totalMinor: 100000,
      amountPaidMinor: 40000,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-08',
    });

    expect(result).toEqual({
      status: 'partially_paid',
      amountDueMinor: 60000,
      isOverdue: false,
    });
  });

  test('any unpaid balance after due date returns overdue', () => {
    const result = evaluateSettlement({
      totalMinor: 100000,
      amountPaidMinor: 0,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-16',
    });

    expect(result).toEqual({
      status: 'overdue',
      amountDueMinor: 100000,
      isOverdue: true,
    });
  });

  test('partial unpaid balance after due date returns overdue', () => {
    const result = evaluateSettlement({
      totalMinor: 100000,
      amountPaidMinor: 40000,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-16',
    });

    expect(result).toEqual({
      status: 'overdue',
      amountDueMinor: 60000,
      isOverdue: true,
    });
  });

  test('full payment before due date returns paid', () => {
    const result = evaluateSettlement({
      totalMinor: 100000,
      amountPaidMinor: 100000,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-08',
    });

    expect(result).toEqual({
      status: 'paid',
      amountDueMinor: 0,
      isOverdue: false,
    });
  });

  test('full payment after due date still returns paid', () => {
    const result = evaluateSettlement({
      totalMinor: 100000,
      amountPaidMinor: 100000,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-16',
    });

    expect(result).toEqual({
      status: 'paid',
      amountDueMinor: 0,
      isOverdue: false,
    });
  });

  test('the due date itself is not overdue', () => {
    const result = evaluateSettlement({
      totalMinor: 100000,
      amountPaidMinor: 0,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-15',
    });

    expect(result.status).toBe('pending');
    expect(result.isOverdue).toBe(false);
  });

  test('invalid total throws a ZodError', () => {
    expect(() =>
      evaluateSettlement({
        totalMinor: 0,
        amountPaidMinor: 0,
        dueDate: '2026-08-15',
        asOfUtcDate: '2026-08-08',
      }),
    ).toThrow();
  });

  test('amount paid greater than total throws a ZodError', () => {
    expect(() =>
      evaluateSettlement({
        totalMinor: 100000,
        amountPaidMinor: 100001,
        dueDate: '2026-08-15',
        asOfUtcDate: '2026-08-08',
      }),
    ).toThrow();
  });

  test('invalid date throws a ZodError', () => {
    expect(() =>
      evaluateSettlement({
        totalMinor: 100000,
        amountPaidMinor: 0,
        dueDate: 'invalid',
        asOfUtcDate: '2026-08-08',
      }),
    ).toThrow();
  });
});

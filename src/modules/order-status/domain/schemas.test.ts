import { describe, expect, test } from 'vitest';

import {
  settlementInputSchema,
  type SettlementStatus,
} from '@/modules/order-status/domain/schemas';

describe('settlementInputSchema', () => {
  test('accepts valid input with positive total and zero paid', () => {
    const result = settlementInputSchema.parse({
      totalMinor: 100000,
      amountPaidMinor: 0,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-08',
    });

    expect(result).toEqual({
      totalMinor: 100000,
      amountPaidMinor: 0,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-08',
    });
  });

  test('rejects a zero total', () => {
    const result = settlementInputSchema.safeParse({
      totalMinor: 0,
      amountPaidMinor: 0,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-08',
    });

    expect(result.success).toBe(false);
  });

  test('rejects a negative total', () => {
    const result = settlementInputSchema.safeParse({
      totalMinor: -100,
      amountPaidMinor: 0,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-08',
    });

    expect(result.success).toBe(false);
  });

  test('rejects negative amount paid', () => {
    const result = settlementInputSchema.safeParse({
      totalMinor: 100000,
      amountPaidMinor: -1,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-08',
    });

    expect(result.success).toBe(false);
  });

  test('rejects amount paid greater than total', () => {
    const result = settlementInputSchema.safeParse({
      totalMinor: 100000,
      amountPaidMinor: 100001,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-08',
    });

    expect(result.success).toBe(false);
  });

  test('rejects an invalid date format', () => {
    const result = settlementInputSchema.safeParse({
      totalMinor: 100000,
      amountPaidMinor: 0,
      dueDate: 'not-a-date',
      asOfUtcDate: '2026-08-08',
    });

    expect(result.success).toBe(false);
  });
});

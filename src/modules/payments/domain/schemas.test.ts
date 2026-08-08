import { describe, expect, test } from 'vitest';

import {
  idempotencyKeySchema,
  recordPaymentInputSchema,
} from '@/modules/payments/domain/schemas';

describe('recordPaymentInputSchema', () => {
  test('accepts a valid payment with amount and date', () => {
    const result = recordPaymentInputSchema.safeParse({
      amountMinor: 40000,
      paymentDate: '2026-08-08',
    });
    expect(result.success).toBe(true);
  });

  test('accepts a payment with an optional note', () => {
    const result = recordPaymentInputSchema.safeParse({
      amountMinor: 40000,
      paymentDate: '2026-08-08',
      note: 'First installment',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBe('First installment');
    }
  });

  test('rejects a zero amount', () => {
    const result = recordPaymentInputSchema.safeParse({
      amountMinor: 0,
      paymentDate: '2026-08-08',
    });
    expect(result.success).toBe(false);
  });

  test('rejects a negative amount', () => {
    const result = recordPaymentInputSchema.safeParse({
      amountMinor: -100,
      paymentDate: '2026-08-08',
    });
    expect(result.success).toBe(false);
  });

  test('rejects a non-integer amount', () => {
    const result = recordPaymentInputSchema.safeParse({
      amountMinor: 40.5,
      paymentDate: '2026-08-08',
    });
    expect(result.success).toBe(false);
  });

  test('rejects an invalid date format', () => {
    const result = recordPaymentInputSchema.safeParse({
      amountMinor: 40000,
      paymentDate: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  test('treats whitespace-only note as null', () => {
    const result = recordPaymentInputSchema.safeParse({
      amountMinor: 40000,
      paymentDate: '2026-08-08',
      note: '   ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBeNull();
    }
  });

  test('rejects a note over 1000 characters', () => {
    const result = recordPaymentInputSchema.safeParse({
      amountMinor: 40000,
      paymentDate: '2026-08-08',
      note: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  test('strips client-supplied extra fields', () => {
    const result = recordPaymentInputSchema.safeParse({
      amountMinor: 40000,
      paymentDate: '2026-08-08',
      merchantId: 'attacker',
      orderId: 'attacker',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('merchantId');
      expect(result.data).not.toHaveProperty('orderId');
    }
  });
});

describe('idempotencyKeySchema', () => {
  test('accepts a non-empty string', () => {
    const result = idempotencyKeySchema.safeParse('unique-key-123');
    expect(result.success).toBe(true);
  });

  test('rejects an empty string', () => {
    const result = idempotencyKeySchema.safeParse('');
    expect(result.success).toBe(false);
  });

  test('rejects missing key', () => {
    const result = idempotencyKeySchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });

  test('trims whitespace', () => {
    const result = idempotencyKeySchema.safeParse('  key-123  ');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('key-123');
    }
  });
});

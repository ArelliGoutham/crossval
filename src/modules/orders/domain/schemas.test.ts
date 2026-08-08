import { describe, expect, test } from 'vitest';

import {
  createOrderInputSchema,
  listOrdersQuerySchema,
  updateOrderInputSchema,
} from '@/modules/orders/domain/schemas';

describe('createOrderInputSchema', () => {
  test('accepts a valid order with line items', () => {
    const result = createOrderInputSchema.safeParse({
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    expect(result.success).toBe(true);
  });

  test('rejects an empty customer name', () => {
    const result = createOrderInputSchema.safeParse({
      customer: '',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    expect(result.success).toBe(false);
  });

  test('rejects an empty line items array', () => {
    const result = createOrderInputSchema.safeParse({
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [],
    });

    expect(result.success).toBe(false);
  });

  test('rejects a line item with empty description', () => {
    const result = createOrderInputSchema.safeParse({
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: '', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    expect(result.success).toBe(false);
  });

  test('rejects quantity less than 1', () => {
    const result = createOrderInputSchema.safeParse({
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 0, unitPriceMinor: 50000 },
      ],
    });

    expect(result.success).toBe(false);
  });

  test('rejects non-integer quantity', () => {
    const result = createOrderInputSchema.safeParse({
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 1.5, unitPriceMinor: 50000 },
      ],
    });

    expect(result.success).toBe(false);
  });

  test('rejects unit price less than 1', () => {
    const result = createOrderInputSchema.safeParse({
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 0 },
      ],
    });

    expect(result.success).toBe(false);
  });

  test('rejects an invalid date format', () => {
    const result = createOrderInputSchema.safeParse({
      customer: 'Acme Corp',
      dueDate: 'not-a-date',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    expect(result.success).toBe(false);
  });

  test('strips client-supplied fields not in the schema', () => {
    const result = createOrderInputSchema.safeParse({
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
      totalMinor: 999999,
      merchantId: 'attacker-merchant',
      status: 'paid',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('totalMinor');
      expect(result.data).not.toHaveProperty('merchantId');
      expect(result.data).not.toHaveProperty('status');
    }
  });
});

describe('updateOrderInputSchema', () => {
  test('accepts a valid partial update', () => {
    const result = updateOrderInputSchema.safeParse({
      customer: 'Updated Corp',
      dueDate: '2026-08-20',
      lineItems: [
        { description: 'Gadget', quantity: 1, unitPriceMinor: 25000 },
      ],
    });

    expect(result.success).toBe(true);
  });

  test('accepts updating only customer', () => {
    const result = updateOrderInputSchema.safeParse({
      customer: 'New Name',
    });

    expect(result.success).toBe(true);
  });

  test('rejects empty customer', () => {
    const result = updateOrderInputSchema.safeParse({
      customer: '',
    });

    expect(result.success).toBe(false);
  });
});

describe('listOrdersQuerySchema', () => {
  test('accepts no status filter', () => {
    const result = listOrdersQuerySchema.safeParse({});

    expect(result.success).toBe(true);
  });

  test('accepts a valid status filter', () => {
    const result = listOrdersQuerySchema.safeParse({ status: 'pending' });

    expect(result.success).toBe(true);
  });

  test('rejects an invalid status', () => {
    const result = listOrdersQuerySchema.safeParse({ status: 'invalid' });

    expect(result.success).toBe(false);
  });
});

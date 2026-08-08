import { describe, expect, test } from 'vitest';

import {
  computeLineTotal,
  computeSubtotal,
} from '@/modules/orders/domain/totals';

describe('computeLineTotal', () => {
  test('multiplies quantity by unit price', () => {
    expect(computeLineTotal(2, 50000)).toBe(100000);
  });

  test('handles quantity of 1', () => {
    expect(computeLineTotal(1, 50000)).toBe(50000);
  });

  test('handles large values', () => {
    expect(computeLineTotal(100, 10000000)).toBe(1000000000);
  });
});

describe('computeSubtotal', () => {
  test('sums line totals', () => {
    expect(computeSubtotal([100000, 50000])).toBe(150000);
  });

  test('handles a single line item', () => {
    expect(computeSubtotal([100000])).toBe(100000);
  });

  test('handles the assignment example: 2 x 500 = 100000', () => {
    expect(computeSubtotal([computeLineTotal(2, 50000)])).toBe(100000);
  });
});

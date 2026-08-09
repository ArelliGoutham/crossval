import { describe, expect, test } from 'vitest';

import { computeRequestHash } from '@/modules/payments/domain/request-hash';

describe('computeRequestHash', () => {
  test('returns a deterministic hash for the same input', () => {
    const hash1 = computeRequestHash({
      amountMinor: 40000,
      paymentDate: '2026-08-08',
      note: null,
    });
    const hash2 = computeRequestHash({
      amountMinor: 40000,
      paymentDate: '2026-08-08',
      note: null,
    });
    expect(hash1).toBe(hash2);
  });

  test('returns different hashes for different amounts', () => {
    const hash1 = computeRequestHash({
      amountMinor: 40000,
      paymentDate: '2026-08-08',
      note: null,
    });
    const hash2 = computeRequestHash({
      amountMinor: 60000,
      paymentDate: '2026-08-08',
      note: null,
    });
    expect(hash1).not.toBe(hash2);
  });

  test('returns different hashes for different dates', () => {
    const hash1 = computeRequestHash({
      amountMinor: 40000,
      paymentDate: '2026-08-08',
      note: null,
    });
    const hash2 = computeRequestHash({
      amountMinor: 40000,
      paymentDate: '2026-08-09',
      note: null,
    });
    expect(hash1).not.toBe(hash2);
  });

  test('returns different hashes for different notes', () => {
    const hash1 = computeRequestHash({
      amountMinor: 40000,
      paymentDate: '2026-08-08',
      note: 'first',
    });
    const hash2 = computeRequestHash({
      amountMinor: 40000,
      paymentDate: '2026-08-08',
      note: 'second',
    });
    expect(hash1).not.toBe(hash2);
  });

  test('produces a SHA-256 hex string', () => {
    const hash = computeRequestHash({
      amountMinor: 40000,
      paymentDate: '2026-08-08',
      note: null,
    });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

import { createHash } from 'node:crypto';

import type { RecordPaymentInput } from '@/modules/payments/domain/schemas';

export function computeRequestHash(input: RecordPaymentInput): string {
  const normalized = JSON.stringify({
    amountMinor: input.amountMinor,
    paymentDate: input.paymentDate,
    note: input.note,
  });

  return createHash('sha256').update(normalized).digest('hex');
}

import { z } from 'zod';

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must be in YYYY-MM-DD format.')
  .refine((value) => {
    const parts = value.split('-');
    const year = Number.parseInt(parts[0] ?? '', 10);
    const month = Number.parseInt(parts[1] ?? '', 10);
    const day = Number.parseInt(parts[2] ?? '', 10);
    const constructed = new Date(Date.UTC(year, month - 1, day));
    return (
      constructed.getUTCFullYear() === year &&
      constructed.getUTCMonth() === month - 1 &&
      constructed.getUTCDate() === day
    );
  }, 'Payment date must be a valid calendar date.');

export const recordPaymentInputSchema = z.object({
  amountMinor: z
    .number()
    .int('Amount must be an integer.')
    .positive('Amount must be positive.'),
  paymentDate: dateOnlySchema,
  note: z
    .string()
    .trim()
    .max(1000, 'Note must be at most 1000 characters.')
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : value)),
});

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(1, 'Idempotency-Key header is required.');

export type RecordPaymentInput = z.infer<typeof recordPaymentInputSchema>;

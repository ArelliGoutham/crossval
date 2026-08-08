import { z } from 'zod';

export const settlementStatusSchema = z.enum([
  'pending',
  'partially_paid',
  'paid',
  'overdue',
]);

export type SettlementStatus = z.infer<typeof settlementStatusSchema>;

const positiveIntMinorSchema = z
  .number()
  .int()
  .positive('Value must be a positive integer.');

const amountPaidSchema = z
  .number()
  .int()
  .min(0, 'Amount paid must be a non-negative integer.');

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.')
  .refine((value) => {
    const parsed = new Date(value + 'T00:00:00.000Z');
    return !Number.isNaN(parsed.getTime());
  }, 'Date must be a valid calendar date.');

export const settlementInputSchema = z
  .object({
    totalMinor: positiveIntMinorSchema,
    amountPaidMinor: amountPaidSchema,
    dueDate: dateOnlySchema,
    asOfUtcDate: dateOnlySchema,
  })
  .refine((input) => input.amountPaidMinor <= input.totalMinor, {
    message: 'Amount paid cannot exceed the order total.',
    path: ['amountPaidMinor'],
  });

export type SettlementInput = z.infer<typeof settlementInputSchema>;

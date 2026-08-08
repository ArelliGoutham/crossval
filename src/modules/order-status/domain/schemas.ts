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

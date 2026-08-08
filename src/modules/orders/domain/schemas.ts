import { z } from 'zod';

const customerSchema = z.string().trim().min(1, 'Customer name is required.');

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format.')
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
  }, 'Due date must be a valid calendar date.');

const lineItemInputSchema = z.object({
  description: z.string().trim().min(1, 'Description is required.'),
  quantity: z
    .number()
    .int('Quantity must be an integer.')
    .min(1, 'Quantity must be at least 1.'),
  unitPriceMinor: z
    .number()
    .int('Unit price must be an integer.')
    .min(1, 'Unit price must be at least 1 minor unit.'),
});

export const createOrderInputSchema = z.object({
  customer: customerSchema,
  dueDate: dateOnlySchema,
  lineItems: z
    .array(lineItemInputSchema)
    .min(1, 'At least one line item is required.'),
});

export const updateOrderInputSchema = z
  .object({
    customer: customerSchema.optional(),
    dueDate: dateOnlySchema.optional(),
    lineItems: z
      .array(lineItemInputSchema)
      .min(1, 'At least one line item is required.')
      .optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one field must be provided for update.',
  });

export const listOrdersQuerySchema = z.object({
  status: z.enum(['pending', 'partially_paid', 'paid', 'overdue']).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderInputSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

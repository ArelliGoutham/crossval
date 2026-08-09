import { z } from 'zod';

export const dashboardFilterSchema = z.object({
  status: z.enum(['pending', 'partially_paid', 'paid', 'overdue']).optional(),
});

export type DashboardFilter = z.infer<typeof dashboardFilterSchema>;

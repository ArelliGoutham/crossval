export type {
  DashboardDetailUseCase,
  DashboardListUseCase,
  DashboardOrderRow,
  OrderDetailResult,
  PaymentHistoryItem,
} from '@/modules/dashboard/domain/types';
export {
  dashboardFilterSchema,
  type DashboardFilter,
} from '@/modules/dashboard/domain/schemas';

export async function composeDashboardService(): Promise<
  import('@/modules/dashboard/application/dashboard-service').DashboardService
> {
  const [{ composeOrdersService }, { composePaymentsService }] =
    await Promise.all([
      import('@/modules/orders/public'),
      import('@/modules/payments/public'),
    ]);

  const [orders, payments] = await Promise.all([
    composeOrdersService(),
    composePaymentsService(),
  ]);

  const { DashboardService } =
    await import('@/modules/dashboard/application/dashboard-service');

  return new DashboardService({ orders, payments });
}

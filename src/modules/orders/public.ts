export {
  createOrderInputSchema,
  listOrdersQuerySchema,
  updateOrderInputSchema,
  type CreateOrderInput,
  type ListOrdersQuery,
  type UpdateOrderInput,
} from '@/modules/orders/domain/schemas';
export {
  OrderError,
  type OrderErrorCode,
} from '@/modules/orders/domain/errors';
export type {
  OrderSettlementPort,
  OrderSettlementSnapshot,
} from '@/modules/orders/domain/ports';
export type {
  CreateOrderUseCase,
  DeleteOrderUseCase,
  GetOrderUseCase,
  ListOrdersUseCase,
  OrderResult,
  OrderSummary,
  StoredLineItem,
  UpdateOrderUseCase,
} from '@/modules/orders/domain/types';

export async function composeOrdersService(): Promise<
  import('@/modules/orders/application/order-service').OrderService
> {
  const { createOrdersModule } =
    await import('@/modules/orders/infrastructure/create-orders-module');
  return createOrdersModule();
}

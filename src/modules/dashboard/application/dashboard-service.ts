import type { AuthenticatedMerchant } from '@/modules/identity/public';
import type {
  ListOrdersUseCase,
  GetOrderUseCase,
  OrderSummary,
} from '@/modules/orders/public';
import type {
  ListPaymentsUseCase,
  PaymentListItem,
} from '@/modules/payments/public';
import type { SettlementStatus } from '@/modules/order-status/public';
import type {
  DashboardOrderRow,
  DashboardListUseCase,
  DashboardDetailUseCase,
  OrderDetailResult,
} from '@/modules/dashboard/domain/types';
import { dashboardFilterSchema } from '@/modules/dashboard/domain/schemas';

type DashboardServiceDependencies = {
  orders: ListOrdersUseCase & GetOrderUseCase;
  payments: ListPaymentsUseCase;
};

export class DashboardService
  implements DashboardListUseCase, DashboardDetailUseCase
{
  readonly #orders: ListOrdersUseCase & GetOrderUseCase;
  readonly #payments: ListPaymentsUseCase;

  constructor(dependencies: DashboardServiceDependencies) {
    this.#orders = dependencies.orders;
    this.#payments = dependencies.payments;
  }

  async getDashboardOrders(
    merchant: AuthenticatedMerchant,
    filters: { status?: SettlementStatus },
  ): Promise<readonly DashboardOrderRow[]> {
    const validated = dashboardFilterSchema.parse(filters);
    const orders = await this.#orders.listOrders(merchant, {});

    const rows = orders.map(toDashboardRow);

    if (validated.status === undefined) {
      return rows;
    }

    return rows.filter((row) => row.status === validated.status);
  }

  async getOrderDetail(
    merchant: AuthenticatedMerchant,
    orderId: string,
  ): Promise<OrderDetailResult> {
    const order = await this.#orders.getOrder(merchant, orderId);
    const payments = await this.#payments.listPayments(merchant, orderId);

    return {
      id: order.id,
      customer: order.customer,
      dueDate: order.dueDate,
      lineItems: order.lineItems,
      subtotalMinor: order.subtotalMinor,
      totalMinor: order.totalMinor,
      amountPaidMinor: order.amountPaidMinor,
      amountDueMinor: order.amountDueMinor,
      status: order.status,
      paymentCount: order.paymentCount,
      payments,
    };
  }
}

function toDashboardRow(order: OrderSummary): DashboardOrderRow {
  return {
    id: order.id,
    customer: order.customer,
    status: order.status,
    totalMinor: order.totalMinor,
    amountPaidMinor: order.amountPaidMinor,
    amountDueMinor: order.amountDueMinor,
    dueDate: order.dueDate,
  };
}

import type { SettlementStatus } from '@/modules/order-status/public';
import type { StoredLineItem } from '@/modules/orders/public';
import type { PaymentListItem } from '@/modules/payments/public';

export interface DashboardOrderRow {
  readonly id: string;
  readonly customer: string;
  readonly status: SettlementStatus;
  readonly totalMinor: number;
  readonly amountPaidMinor: number;
  readonly amountDueMinor: number;
  readonly dueDate: string;
}

export type PaymentHistoryItem = PaymentListItem;

export interface OrderDetailResult {
  readonly id: string;
  readonly customer: string;
  readonly dueDate: string;
  readonly lineItems: readonly StoredLineItem[];
  readonly subtotalMinor: number;
  readonly totalMinor: number;
  readonly amountPaidMinor: number;
  readonly amountDueMinor: number;
  readonly status: SettlementStatus;
  readonly paymentCount: number;
  readonly payments: readonly PaymentHistoryItem[];
}

export interface DashboardListUseCase {
  getDashboardOrders(
    merchant: import('@/modules/identity/public').AuthenticatedMerchant,
    filters: { status?: SettlementStatus },
  ): Promise<readonly DashboardOrderRow[]>;
}

export interface DashboardDetailUseCase {
  getOrderDetail(
    merchant: import('@/modules/identity/public').AuthenticatedMerchant,
    orderId: string,
  ): Promise<OrderDetailResult>;
}

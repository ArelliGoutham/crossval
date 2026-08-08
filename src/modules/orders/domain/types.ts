import type { AuthenticatedMerchant } from '@/modules/identity/public';
import type { SettlementResult } from '@/modules/order-status/public';
import type {
  CreateOrderInput,
  ListOrdersQuery,
  UpdateOrderInput,
} from '@/modules/orders/domain/schemas';

export interface StoredLineItem {
  readonly id: string;
  readonly description: string;
  readonly quantity: number;
  readonly unitPriceMinor: number;
  readonly lineTotalMinor: number;
}

export interface StoredOrder {
  readonly id: string;
  readonly merchantId: string;
  readonly customer: string;
  readonly dueDate: string;
  readonly lineItems: readonly StoredLineItem[];
  readonly subtotalMinor: number;
  readonly totalMinor: number;
  readonly amountPaidMinor: number;
  readonly paymentCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface NewStoredOrder {
  readonly id: string;
  readonly merchantId: string;
  readonly customer: string;
  readonly dueDate: string;
  readonly lineItems: readonly StoredLineItem[];
  readonly subtotalMinor: number;
  readonly totalMinor: number;
  readonly amountPaidMinor: number;
  readonly paymentCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface OrderResult {
  readonly id: string;
  readonly customer: string;
  readonly dueDate: string;
  readonly lineItems: readonly StoredLineItem[];
  readonly subtotalMinor: number;
  readonly totalMinor: number;
  readonly amountPaidMinor: number;
  readonly amountDueMinor: number;
  readonly status: SettlementResult['status'];
  readonly paymentCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface OrderSummary {
  readonly id: string;
  readonly customer: string;
  readonly dueDate: string;
  readonly totalMinor: number;
  readonly amountPaidMinor: number;
  readonly amountDueMinor: number;
  readonly status: SettlementResult['status'];
  readonly paymentCount: number;
}

export interface CreateOrderUseCase {
  createOrder(
    merchant: AuthenticatedMerchant,
    input: CreateOrderInput,
  ): Promise<OrderResult>;
}

export interface ListOrdersUseCase {
  listOrders(
    merchant: AuthenticatedMerchant,
    query: ListOrdersQuery,
  ): Promise<readonly OrderSummary[]>;
}

export interface GetOrderUseCase {
  getOrder(
    merchant: AuthenticatedMerchant,
    orderId: string,
  ): Promise<OrderResult>;
}

export interface UpdateOrderUseCase {
  updateOrder(
    merchant: AuthenticatedMerchant,
    orderId: string,
    input: UpdateOrderInput,
  ): Promise<OrderResult>;
}

export interface DeleteOrderUseCase {
  deleteOrder(merchant: AuthenticatedMerchant, orderId: string): Promise<void>;
}

import type { AuthenticatedMerchant } from '@/modules/identity/public';
import type { SettlementStatus } from '@/modules/order-status/public';
import type { RecordPaymentInput } from '@/modules/payments/domain/schemas';

export interface StoredPayment {
  readonly id: string;
  readonly merchantId: string;
  readonly orderId: string;
  readonly amountMinor: number;
  readonly paymentDate: string;
  readonly note: string | null;
  readonly idempotencyKey: string;
  readonly createdBy: string;
  readonly createdAt: Date;
}

export interface NewStoredPayment {
  readonly id: string;
  readonly merchantId: string;
  readonly orderId: string;
  readonly amountMinor: number;
  readonly paymentDate: string;
  readonly note: string | null;
  readonly idempotencyKey: string;
  readonly createdBy: string;
  readonly createdAt: Date;
}

export interface PaymentResult {
  readonly id: string;
  readonly orderId: string;
  readonly amountMinor: number;
  readonly paymentDate: string;
  readonly note: string | null;
  readonly statusBefore: SettlementStatus;
  readonly statusAfter: SettlementStatus;
  readonly amountDueMinorAfter: number;
  readonly createdAt: Date;
}

export interface PaymentListItem {
  readonly id: string;
  readonly orderId: string;
  readonly amountMinor: number;
  readonly paymentDate: string;
  readonly note: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
}

export interface IdempotencyRecord {
  readonly merchantId: string;
  readonly operation: string;
  readonly key: string;
  readonly requestHash: string;
  readonly outcome: 'succeeded' | 'rejected';
  readonly response: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
  readonly completedAt: Date;
}

export interface RecordPaymentOutcome {
  readonly result: PaymentResult;
  readonly replayed: boolean;
  readonly httpStatus: number;
}

export interface RecordPaymentUseCase {
  recordPayment(
    merchant: AuthenticatedMerchant,
    orderId: string,
    input: RecordPaymentInput,
    idempotencyKey: string,
  ): Promise<RecordPaymentOutcome>;
}

export interface ListPaymentsUseCase {
  listPayments(
    merchant: AuthenticatedMerchant,
    orderId: string,
  ): Promise<readonly PaymentListItem[]>;
}

export interface HasPaymentsUseCase {
  hasPayments(merchantId: string, orderId: string): Promise<boolean>;
}

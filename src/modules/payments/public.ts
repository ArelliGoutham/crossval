export {
  idempotencyKeySchema,
  recordPaymentInputSchema,
  type RecordPaymentInput,
} from '@/modules/payments/domain/schemas';
export {
  PaymentError,
  type PaymentErrorCode,
} from '@/modules/payments/domain/errors';
export type {
  HasPaymentsUseCase,
  ListPaymentsUseCase,
  PaymentResult,
  RecordPaymentOutcome,
  RecordPaymentUseCase,
  StoredPayment,
} from '@/modules/payments/domain/types';

export async function composePaymentsService(): Promise<
  import('@/modules/payments/application/payment-service').PaymentService
> {
  const { createPaymentsModule } =
    await import('@/modules/payments/infrastructure/create-payments-module');
  return createPaymentsModule();
}

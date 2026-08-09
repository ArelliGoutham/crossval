import { PaymentError } from '@/modules/payments/domain/errors';
import type {
  IdGenerator,
  PaymentAuditEvent,
  PaymentReadClock,
  PaymentRepository,
  PaymentTransactionRunner,
} from '@/modules/payments/domain/ports';
import {
  idempotencyKeySchema,
  recordPaymentInputSchema,
  type RecordPaymentInput,
} from '@/modules/payments/domain/schemas';
import { computeRequestHash } from '@/modules/payments/domain/request-hash';
import type { AuthenticatedMerchant } from '@/modules/identity/public';
import { evaluateSettlement } from '@/modules/order-status/public';
import type {
  PaymentListItem,
  PaymentResult,
  RecordPaymentOutcome,
  RecordPaymentUseCase,
  ListPaymentsUseCase,
  HasPaymentsUseCase,
  StoredPayment,
} from '@/modules/payments/domain/types';

const IDEMPOTENCY_OPERATION = 'recordPayment';

type PaymentServiceDependencies = {
  payments: PaymentRepository;
  transactions: PaymentTransactionRunner;
  clock: PaymentReadClock;
  ids: IdGenerator;
};

export class PaymentService
  implements RecordPaymentUseCase, ListPaymentsUseCase, HasPaymentsUseCase
{
  readonly #payments: PaymentRepository;
  readonly #transactions: PaymentTransactionRunner;
  readonly #clock: PaymentReadClock;
  readonly #ids: IdGenerator;

  constructor(dependencies: PaymentServiceDependencies) {
    this.#payments = dependencies.payments;
    this.#transactions = dependencies.transactions;
    this.#clock = dependencies.clock;
    this.#ids = dependencies.ids;
  }

  async recordPayment(
    merchant: AuthenticatedMerchant,
    orderId: string,
    input: RecordPaymentInput,
    idempotencyKey: string,
  ): Promise<RecordPaymentOutcome> {
    const validatedInput = recordPaymentInputSchema.parse(input);
    const validatedKey = idempotencyKeySchema.parse(idempotencyKey);
    const requestHash = computeRequestHash(validatedInput);
    const now = this.#clock.now();

    const outcome = await this.#transactions.run(async (tx) => {
      const claimResult = await tx.claimIdempotency(
        {
          merchantId: merchant.merchantId,
          operation: IDEMPOTENCY_OPERATION,
          key: validatedKey,
          requestHash,
        },
        now,
      );

      if (claimResult.status === 'completed' && claimResult.record) {
        const stored = claimResult.record.response as {
          result: PaymentResult;
          httpStatus: number;
        };
        return {
          kind: 'replay' as const,
          result: {
            result: stored.result,
            replayed: true,
            httpStatus: 200,
          },
        };
      }

      if (claimResult.status === 'conflict') {
        return {
          kind: 'error' as const,
          error: new PaymentError(
            'idempotency_key_reused',
            'Idempotency key was used with a different request body.',
          ),
        };
      }

      const snapshot = await tx.getOrderSnapshot(merchant.merchantId, orderId);

      if (snapshot === null) {
        return {
          kind: 'error' as const,
          error: new PaymentError('order_not_found', 'Order not found.'),
        };
      }

      const statusBefore = evaluateSettlement({
        totalMinor: snapshot.totalMinor,
        amountPaidMinor: snapshot.amountPaidMinor,
        dueDate: snapshot.dueDate,
        asOfUtcDate: toUtcDateString(now),
      });

      const reserveResult = await tx.reserveBalance(
        merchant.merchantId,
        orderId,
        validatedInput.amountMinor,
      );

      if (!reserveResult.succeeded) {
        const auditEvent: PaymentAuditEvent = {
          action: 'payments.record.rejected',
          occurredAt: now,
          merchantId: merchant.merchantId,
          orderId,
          paymentId: null,
          actorId: merchant.userId,
          amountMinor: validatedInput.amountMinor,
          statusBefore: statusBefore.status,
          statusAfter: statusBefore.status,
          rejectionCode: 'OVERPAYMENT',
        };
        await tx.recordAudit(auditEvent);

        await tx.completeIdempotency(
          merchant.merchantId,
          IDEMPOTENCY_OPERATION,
          validatedKey,
          'rejected',
          {
            error: {
              code: 'OVERPAYMENT',
              maximumAllowedAmountMinor:
                reserveResult.maximumAllowedAmountMinor,
            },
            httpStatus: 422,
          },
          now,
        );

        return {
          kind: 'error' as const,
          error: new PaymentError(
            'overpayment',
            'Payment exceeds the remaining balance.',
            {
              maximumAllowedAmountMinor:
                reserveResult.maximumAllowedAmountMinor,
            },
          ),
        };
      }

      const paymentId = this.#ids.generate();
      const newPayment = {
        id: paymentId,
        merchantId: merchant.merchantId,
        orderId,
        amountMinor: validatedInput.amountMinor,
        paymentDate: validatedInput.paymentDate,
        note: validatedInput.note,
        idempotencyKey: validatedKey,
        createdBy: merchant.userId,
        createdAt: now,
      };

      await tx.insertPayment(newPayment);

      const statusAfter = evaluateSettlement({
        totalMinor: snapshot.totalMinor,
        amountPaidMinor: reserveResult.amountPaidMinor,
        dueDate: snapshot.dueDate,
        asOfUtcDate: toUtcDateString(now),
      });

      const result: PaymentResult = {
        id: paymentId,
        orderId,
        amountMinor: validatedInput.amountMinor,
        paymentDate: validatedInput.paymentDate,
        note: validatedInput.note,
        statusBefore: statusBefore.status,
        statusAfter: statusAfter.status,
        amountDueMinorAfter: statusAfter.amountDueMinor,
        createdAt: now,
      };

      const auditEvent: PaymentAuditEvent = {
        action: 'payments.record.succeeded',
        occurredAt: now,
        merchantId: merchant.merchantId,
        orderId,
        paymentId,
        actorId: merchant.userId,
        amountMinor: validatedInput.amountMinor,
        statusBefore: statusBefore.status,
        statusAfter: statusAfter.status,
        rejectionCode: null,
      };
      await tx.recordAudit(auditEvent);

      await tx.completeIdempotency(
        merchant.merchantId,
        IDEMPOTENCY_OPERATION,
        validatedKey,
        'succeeded',
        { result, httpStatus: 201 },
        now,
      );

      return {
        kind: 'success' as const,
        result: { result, replayed: false, httpStatus: 201 },
      };
    });

    if (outcome.kind === 'error') {
      throw outcome.error;
    }

    return outcome.result;
  }

  async listPayments(
    merchant: AuthenticatedMerchant,
    orderId: string,
  ): Promise<readonly PaymentListItem[]> {
    const payments = await this.#payments.listByOrderId(
      merchant.merchantId,
      orderId,
    );
    return payments.map(toPaymentListItem);
  }

  async hasPayments(merchantId: string, orderId: string): Promise<boolean> {
    const count = await this.#payments.countByOrderId(merchantId, orderId);
    return count > 0;
  }
}

function toPaymentListItem(payment: StoredPayment): PaymentListItem {
  return {
    id: payment.id,
    orderId: payment.orderId,
    amountMinor: payment.amountMinor,
    paymentDate: payment.paymentDate,
    note: payment.note,
    createdBy: payment.createdBy,
    createdAt: payment.createdAt,
  };
}

function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

# Module 04: Payments

## Status

Approved for documentation. No implementation has begun.

## Purpose

Record immutable full or partial payments, prevent over-payment under concurrency, provide payment history, and maintain the payment summary consumed by Orders and Order Status.

## Scope

This module owns payment recording, payment history, idempotency, order-balance reservation, and payment audit events. It does not edit or delete payments, process refunds, or own the order's customer and line-item fields.

## Decisions

- Store payments in a separate immutable `payments` collection.
- Maintain `amountPaidMinor` and `paymentCount` as Payments-owned summary fields on the order document.
- Use a MongoDB transaction for every payment command.
- Require an `Idempotency-Key` header for every payment command.
- Use an explicit idempotency-record collection rather than relying only on a unique key on payments.
- Payment dates use UTC `YYYY-MM-DD` values and cannot be in the future.
- Payment records are never updated or deleted. Refunds are a separate future workflow.

## Domain model

### Payment

| Field                     | Meaning                                          |
| ------------------------- | ------------------------------------------------ |
| `id`                      | Immutable payment identifier.                    |
| `merchantId` / `orderId`  | Tenant and parent order ownership.               |
| `amountMinor`             | Positive integer payment amount.                 |
| `paymentDate`             | UTC date payment was made.                       |
| `note`                    | Optional trimmed note, maximum 1,000 characters. |
| `idempotencyKey`          | Key for this payment command.                    |
| `createdBy` / `createdAt` | Actor and audit timestamp.                       |

### Idempotency record

| Field                            | Meaning                                        |
| -------------------------------- | ---------------------------------------------- |
| `merchantId`, `operation`, `key` | Unique command identity.                       |
| `requestHash`                    | Hash of normalized request input.              |
| `outcome`                        | `succeeded` or `rejected`.                     |
| `response`                       | Sanitized stored HTTP outcome for safe replay. |
| `createdAt` / `completedAt`      | Command timestamps.                            |

Indexes:

- `payments`: `{ merchantId: 1, orderId: 1, paymentDate: -1 }`.
- `idempotency_records`: unique `{ merchantId: 1, operation: 1, key: 1 }`.

## Public contract

- `recordPayment(merchant, orderId, input, idempotencyKey)`
- `listPayments(merchant, orderId)`
- `hasPayments(merchantId, orderId)`

The module depends only on ports: `OrderSettlementPort`, `PaymentRepository`, `IdempotencyRepository`, `TransactionRunner`, `AuditLog`, `Clock`, and the Order Status evaluator.

`OrderSettlementPort` conditionally reserves balance within the transaction. It succeeds only when `amountPaidMinor + requestedAmountMinor <= totalMinor`; otherwise it returns the current maximum permitted amount. This is the sole cross-module mutation of the order payment summary.

## HTTP boundary

| Endpoint                           | Success                                    | Failure behaviour                                                                                                                        |
| ---------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/orders/:id/payments` | `201` new payment; `200` idempotent replay | `400` invalid input; `401` missing session; `404` inaccessible order; `409` key reuse or unresolved in-progress key; `422` over-payment. |
| `GET /api/v1/orders/:id/payments`  | `200` payment history                      | `401` missing session; `404` inaccessible order.                                                                                         |

Zod validates body and header values. The body accepts amount, payment date, and optional note. The authenticated session supplies merchant and actor identity.

## Transaction and idempotency flow

1. Normalize the request and calculate its request hash.
2. Claim the idempotency key in the transaction.
3. If the key already completed with the same hash, return its stored outcome. If its hash differs, return `409 IDEMPOTENCY_KEY_REUSED`.
4. Conditionally reserve the order balance through `OrderSettlementPort`.
5. On success, insert the immutable payment, evaluate status before and after, write the accepted-payment audit event, store the success response, and commit.
6. On insufficient balance, write a sanitized rejection audit event and the `422 OVERPAYMENT` outcome, then commit without creating a payment or changing the order summary.

Concurrent full-payment commands compete at the conditional reservation. Only one can reserve the remaining balance. A transaction retry then makes the losing command observe the updated balance and return `422`.

## Auditability

Successful audit events include actor, merchant, order, payment, amount, timestamp, status before, and status after. Rejected over-payment events include actor, merchant, order, requested amount, current allowed amount, timestamp, and rejection code.

Never place passwords, session tokens, raw idempotency keys, or unrelated request data in audit events.

## Test-first acceptance criteria

Write failing tests before implementation for:

1. Full and partial payments update payment history and order summary atomically.
2. The assignment's `$1,000 -> $400 -> $600` scenario reaches `paid` with zero due.
3. An over-payment creates no payment and returns `422` with the maximum allowed amount.
4. Two simultaneous full payments result in exactly one accepted payment.
5. A repeated idempotency key with the same request replays the original response without a second payment.
6. The same key with a different request returns `409 IDEMPOTENCY_KEY_REUSED`.
7. A merchant cannot record or list payments for another merchant's order.
8. Payment date, note, amount, audit events, and status transitions satisfy validation and audit rules.

## Deferred work

Refunds, payment-provider integration, reconciliation, payment methods, multi-currency, chargebacks, background retry queues, and user-visible payment edits are out of scope.

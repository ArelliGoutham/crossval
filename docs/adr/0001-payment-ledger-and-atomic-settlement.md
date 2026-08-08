# ADR 0001: Separate payment ledger with atomic settlement

## Context

Orders require multiple partial payments, immutable payment history, clear over-payment rejection, and a concurrency approach. The repository rules require strict module boundaries, auditability, and swappable infrastructure adapters.

## Considered options

1. Embed payments inside the order document and update one MongoDB document atomically.
2. Store payment records separately and compute totals only through query aggregation.
3. Store payment records separately, maintain an order payment-summary projection, and update both in a MongoDB transaction.

## Decision

Choose option 3.

Payments are immutable records in a separate `payments` collection. Each order stores the Payments-owned projection `amountPaidMinor` and `paymentCount`. Recording a payment uses a MongoDB transaction that conditionally reserves order balance, inserts the payment, writes audit data, and persists the idempotency outcome together.

The Payments module accesses order settlement only through `OrderSettlementPort`; it does not import the Orders persistence implementation.

## Consequences

- Payment history has its own lifecycle, indexes, and audit-friendly representation.
- Dashboard and detail reads can use the order summary without summing all payments.
- Concurrent payments cannot over-allocate because the reservation is a conditional atomic write.
- MongoDB deployment must support transactions, so the application requires a replica set such as MongoDB Atlas.
- The persistence adapter and tests are more involved than an embedded-payment design.

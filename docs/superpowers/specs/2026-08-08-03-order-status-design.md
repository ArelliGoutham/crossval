# Module 03: Order Status

## Status

Approved for documentation. No implementation has begun.

## Purpose

Derive an order's current settlement status and amount due from its total, payment summary, due date, and a UTC calendar date.

## Scope

This module owns the pure status policy. It does not persist status, write audit events, read a database, expose HTTP endpoints, or record payments.

## Decisions

- Status is always derived; it is not a mutable database field.
- Status precedence is `paid`, `overdue`, `partially_paid`, then `pending`.
- `dueDate` and the current date use UTC date-only `YYYY-MM-DD` semantics.
- An order is overdue only when the current UTC date is strictly later than its due date.
- A fully paid order is always `paid`, even when it was paid after its due date.

## Pure contract

`evaluateSettlement(input)` accepts:

| Field             | Meaning                                                |
| ----------------- | ------------------------------------------------------ |
| `totalMinor`      | Positive integer order total.                          |
| `amountPaidMinor` | Integer cumulative accepted payment amount.            |
| `dueDate`         | ISO UTC calendar date: `YYYY-MM-DD`.                   |
| `asOfUtcDate`     | ISO UTC calendar date supplied by a caller or `Clock`. |

It returns:

| Field            | Meaning                                            |
| ---------------- | -------------------------------------------------- |
| `status`         | `pending`, `partially_paid`, `paid`, or `overdue`. |
| `amountDueMinor` | `totalMinor - amountPaidMinor`.                    |
| `isOverdue`      | Whether status is `overdue`.                       |

The policy is:

```text
if amountPaidMinor === totalMinor -> paid
else if asOfUtcDate > dueDate     -> overdue
else if amountPaidMinor > 0       -> partially_paid
else                               -> pending
```

## Invalid states

The evaluator rejects invalid domain input rather than assigning a misleading status:

- `totalMinor` is not a positive integer.
- `amountPaidMinor` is not an integer from zero through `totalMinor`.
- Either date is not a valid `YYYY-MM-DD` calendar date.

Over-payment is prevented by Payments before it reaches this evaluator. Its presence here is a domain-invariant failure, not an `overdue` or `partially_paid` state.

## Boundary and dependencies

The module depends only on a `Clock` port when callers do not supply `asOfUtcDate`. It is otherwise pure and deterministic.

Payments and dashboard/query code consume this module's public evaluator. They must not reproduce status or amount-due calculations.

## Auditability

This module produces no side effects. The Payments module can evaluate before and after a payment to include a status transition in its audit event.

Time alone can change a visible status from `pending` or `partially_paid` to `overdue`. That change creates no write and no audit event because no persisted state has changed.

## Test-first acceptance criteria

Write failing tests before implementation for:

1. No payments on or before due date returns `pending`.
2. Partial payments on or before due date return `partially_paid`.
3. Any unpaid balance after due date returns `overdue`.
4. Full payment before or after due date returns `paid`.
5. An overdue order later paid in full returns `paid`.
6. The due date itself is not overdue.
7. Invalid totals, payment summaries, and calendar dates are rejected.

## Deferred work

Merchant time zones, grace periods, payment terms, configurable status policies, dunning workflows, and persisted status-transition history are out of scope.

# Module 05: Dashboard

## Status

Approved for documentation. No implementation has begun.

## Purpose

Provide merchant-scoped read models for the order dashboard and order detail page without duplicating order, payment, or status business logic.

## Scope

This module owns dashboard and detail query composition plus UI-facing read models. It does not create or mutate orders or payments, persist status, or own authentication screens and session validation.

## Decisions

- Dashboard status is derived on the server for every query through the Order Status evaluator.
- Filter by an optional derived status after composing active merchant orders.
- The initial take-home scope does not use pagination; production should add cursor pagination and an indexed read projection.
- Default dashboard sort is due date ascending.
- The dashboard and order-detail pages are protected routes. Authentication owns redirects and session validation.

## Public contracts

### Dashboard list

`getDashboardOrders(merchant, filters, asOfUtcDate)` returns one row per active merchant order:

| Field | Meaning |
| --- | --- |
| `id` | Order identifier. |
| `customer` | Customer name. |
| `status` | Current derived settlement status. |
| `totalMinor` | Order total. |
| `amountPaidMinor` | Payments-owned order summary. |
| `amountDueMinor` | Derived total minus paid amount. |
| `dueDate` | UTC date-only due date. |

`filters.status` accepts `pending`, `partially_paid`, `paid`, `overdue`, or no filter for all statuses.

### Order detail

`getOrderDetail(merchant, orderId, asOfUtcDate)` returns the active order, line items, settlement summary, derived status, and full immutable payment history.

## Composition boundary

The module depends only on:

- `OrderReadPort`
- `PaymentHistoryPort`
- Order Status evaluator
- `Clock`

It does not import MongoDB collections or private implementation from Orders, Payments, or Authentication. The authenticated merchant identity is supplied by the caller through the Authentication public contract.

## UI-facing behavior

- `/dashboard` displays a protected table with customer, status, order total, amount paid, amount due, and due date.
- The screen provides an all-status default and filters for pending, partially paid, paid, and overdue.
- An empty state provides a clear create-order action.
- Selecting an order navigates to protected `/orders/:id`.
- `/orders/:id` displays line items, the settlement summary, full payment history, and a payment action only when a balance remains.

Authentication redirects unauthenticated page requests to `/login`; API endpoints return `401` instead of redirecting.

## Validation, errors, and security

Zod validates status filter input at the public boundary. Dashboard list and detail queries are always scoped by the authenticated `merchantId`.

Absent, soft-deleted, and cross-merchant orders are indistinguishable and return `404` for detail queries. Read operations create no audit events because they do not change state.

## Test-first acceptance criteria

Write failing tests before implementation for:

1. Every status filter returns only rows matching the shared Status evaluator.
2. Rows expose exact total, paid, and due values from the approved contracts.
3. Cross-merchant and soft-deleted orders never appear in the list or detail result.
4. Detail contains line items and payment history ordered deterministically by payment date and creation time.
5. The dashboard cannot recalculate status or due amounts outside the shared evaluator.
6. Missing sessions trigger page redirects and API `401` responses through Authentication.

## Deferred work

Cursor pagination, text search, date-range filtering, summary metrics, export, saved views, caching, and a materialized read projection are out of scope.

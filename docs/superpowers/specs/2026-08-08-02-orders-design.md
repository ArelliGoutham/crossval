# Module 02: Orders

## Status

Approved for documentation. No implementation has begun.

## Purpose

Create, read, update, and delete merchant-owned orders with line items and server-computed totals.

## Scope

This module owns the order document, line items, totals, lifecycle policy, and order audit events. It does not record payments, derive status, or implement dashboard-specific query projections.

## Decisions

- All order data is merchant-scoped.
- An order is fully editable and deletable until its first payment is recorded.
- An order with one or more payments is read-only; update and delete requests are rejected.
- Deletion is a soft delete through `deletedAt`, preserving auditability. Normal reads exclude deleted orders.
- `dueDate` is a date-only `YYYY-MM-DD` value. Past dates are valid to support overdue scenarios.
- Money uses integer minor units. The server calculates `subtotalMinor` and `totalMinor`; clients never supply trusted totals.
- The initial product uses one configured display currency. Multi-currency is out of scope.

## Domain model

### Order

| Field | Meaning |
| --- | --- |
| `id` | Immutable order identifier. |
| `merchantId` | Tenant identifier from the authenticated session. |
| `customer` | Non-empty customer name. |
| `dueDate` | Date-only payment expectation. |
| `lineItems` | One or more order line items. |
| `subtotalMinor` | Sum of line-item totals. |
| `totalMinor` | Equal to `subtotalMinor` for this assignment. |
| `createdAt` / `updatedAt` | Audit timestamps. |
| `deletedAt` | Set when soft-deleted; absent for active orders. |

### Line item

| Field | Meaning |
| --- | --- |
| `id` | Stable line-item identifier. |
| `description` | Non-empty item name. |
| `quantity` | Positive integer, at least 1. |
| `unitPriceMinor` | Positive integer minor-unit price, at least 1. |
| `lineTotalMinor` | `quantity * unitPriceMinor`, calculated by the server. |

## Public contract

The Orders module exposes use cases:

- `createOrder(merchant, input)`
- `listOrders(merchant, query)`
- `getOrder(merchant, orderId)`
- `updateOrder(merchant, orderId, input)`
- `deleteOrder(merchant, orderId)`

The module depends only on these ports:

- `OrderRepository`
- `PaymentReadPort`, which exposes `hasPayments(merchantId, orderId)` only
- `Clock`
- `AuditLog`

The Orders module must not import a Payments repository or database model. The payment module satisfies `PaymentReadPort` through an adapter.

## Validation and HTTP boundary

Zod schemas are the single source of truth for request validation and inferred types.

| Endpoint | Success | Failure behaviour |
| --- | --- | --- |
| `POST /api/orders` | `201` with created order | `400` invalid input; `401` missing session. |
| `GET /api/orders` | `200` active orders for current merchant | `401` missing session. |
| `GET /api/orders/:id` | `200` active order | `404` absent, deleted, or outside merchant scope. |
| `PATCH /api/orders/:id` | `200` updated order | `400` invalid input; `404` inaccessible order; `409` payment-locked order. |
| `DELETE /api/orders/:id` | `204` after soft delete | `404` inaccessible order; `409` payment-locked order. |

Incoming payloads accept customer, due date, and line items only. `merchantId`, totals, status, payment amount, and audit fields are server-owned fields.

## Persistence and auditability

MongoDB indexes:

- `{ merchantId: 1, createdAt: -1 }` for the default list.
- `{ merchantId: 1, dueDate: 1 }` for due-date views and future status queries.
- `{ merchantId: 1, deletedAt: 1 }` to efficiently scope active records.

Emit audit events for order creation, update, and soft deletion. Events include actor, merchant, order ID, timestamp, event type, and changed fields. Do not store credentials, session tokens, or unrelated request data.

## Test-first acceptance criteria

Write failing tests before implementation for:

1. Valid line items produce exact server-computed line, subtotal, and order totals.
2. Empty descriptions, empty line-item arrays, non-integer or non-positive quantities, and non-positive prices are rejected.
3. Client-supplied totals, status, merchant IDs, and audit fields are ignored or rejected.
4. A merchant cannot read or mutate another merchant's order; inaccessible IDs receive `404`.
5. Active orders can be updated and soft-deleted before a payment exists.
6. Orders with payments reject update and delete requests with `409`.
7. Soft-deleted orders are absent from normal list/detail reads and remain represented in the audit trail.

## Deferred work

Order-level tax, discounts, currency conversion, customer entities, recurring orders, attachments, and restoration of deleted orders are out of scope.

# Domain context: Orders and Settlements

## Purpose

This application lets a merchant create orders with line items, record full or partial payments, and view the amounts due and derived status of each order.

## Ubiquitous language

- **Merchant**: the tenant that owns all business data. In the initial assignment, one authenticated account represents one merchant.
- **User**: the authenticated person or account acting for a merchant.
- **Order**: a merchant-owned commercial document with a customer, due date, line items, total, and payment history.
- **Line item**: one priced entry on an order, made of a description, quantity, and unit price.
- **Payment**: an immutable amount recorded against one order, with a payment date and optional note.
- **Amount paid**: the sum of accepted payments for an order.
- **Amount due**: the order total minus the amount paid.
- **Order status**: a derived current label based on amount paid and due date. It is not an independently editable field.
- **Over-payment**: a requested payment larger than the current amount due. It must be rejected atomically.
- **Minor unit**: the integer representation of money, such as 1050 for $10.50.

## Non-negotiable rules

- Every order and payment belongs to exactly one merchant.
- A merchant can only read or mutate records it owns.
- An order total is computed from its line items; clients cannot supply a trusted total.
- A payment amount is positive and the cumulative amount paid can never exceed the order total.
- Payment history is append-only and auditable.
- Monetary calculations use integer minor units only.

## Open product decisions

Resolve and record these before implementation:

1. Status precedence when an unpaid order is past due.
2. Due-date time zone and the precise moment an order becomes overdue.
3. Whether orders become read-only after the first payment.
4. The initial currency and display convention.

## Boundaries

- **Identity** authenticates a user and resolves the current merchant.
- **Orders** owns order creation, line items, and order lifecycle policy.
- **Payments** owns payment recording and over-payment prevention.
- **Dashboard/query** reads merchant-owned order summaries without owning financial rules.

Cross-boundary communication occurs through explicit contracts only.

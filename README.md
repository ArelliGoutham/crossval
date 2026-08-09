# CrossVal Orders and Settlements

A merchant-facing web application for creating orders with line items, recording full or partial payments, and viewing a dashboard with derived order status and amounts due.

## Table of contents

- [Live deployment](#live-deployment)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [API overview](#api-overview)
- [Status derivation rules](#status-derivation-rules)
- [Order editability policy](#order-editability-policy)
- [Payment transaction and concurrency approach](#payment-transaction-and-concurrency-approach)
- [Idempotency](#idempotency)
- [Audit approach](#audit-approach)
- [Assumptions and trade-offs](#assumptions-and-trade-offs)
- [What we would improve before production](#what-we-would-improve-before-production)
- [Sample verification flow](#sample-verification-flow)
- [Testing](#testing)
- [Engineering documentation](#engineering-documentation)

## Live deployment

- **App URL:** https://crossval.vercel.app
- **Repository:** https://github.com/ArelliGoutham/crossval

### Demo credentials

The production database is seeded with a demo account and sample orders across all status types:

- **Email:** `demo@crossval.app`
- **Password:** `demo-password-12`

Logged-in demo orders:

| Customer           | Status         | Total     | Paid    | Due       |
| ------------------ | -------------- | --------- | ------- | --------- |
| Acme Industries    | pending        | $1,500.00 | $0.00   | $1,500.00 |
| Globex Corporation | partially paid | $1,000.00 | $500.00 | $500.00   |
| Initech LLC        | paid           | $750.00   | $750.00 | $0.00     |
| Umbrella Corp      | overdue        | $2,000.00 | $0.00   | $2,000.00 |
| Stark Industries   | overdue        | $1,000.00 | $300.00 | $700.00   |
| Wayne Enterprises  | pending        | $250.00   | $0.00   | $250.00   |

To re-seed locally:

```bash
npm run seed
```

## Local setup

Prerequisites: Node.js 20.9 or later, npm, and Docker Compose.

1. Copy the local configuration template: `cp .env.example .env.local`.
2. Generate a bcrypt dummy hash: `node -e "import('bcrypt').then(b => b.hash('dummy-password', 12).then(h => console.log(h)))"` and paste it as `BCRYPT_DUMMY_HASH` in `.env.local`.
3. Start the transaction-capable local MongoDB instance: `docker compose up -d`. MongoDB listens on host port `27018` and container port `27017` because host port `27017` may already be in use.
4. Confirm the replica set is ready: `docker compose exec mongo mongosh --quiet --eval 'rs.status().set'`. It must print `rs0` before running code that uses MongoDB transactions.
5. Install dependencies with `npm install`, then start the application with `npm run dev`.

The local MongoDB client uses a direct connection because Docker exposes one replica-set endpoint (`localhost:27018`) while replica membership uses the internal Docker hostname. Transactions remain available through the single-node `rs0` replica set.

Stop the local database with `docker compose down`. Its named volume retains local data; use `docker compose down -v` only when intentionally discarding that data.

## Environment variables

| Variable            | Purpose                                          | Local default                               |
| ------------------- | ------------------------------------------------ | ------------------------------------------- |
| `MONGODB_URI`       | Replica-set or Atlas connection URI              | `mongodb://localhost:27018/?replicaSet=rs0` |
| `MONGODB_DB_NAME`   | Application database name                        | `crossval`                                  |
| `APP_ORIGIN`        | Canonical origin for cookies and CSRF            | `http://localhost:3000`                     |
| `SESSION_TTL_DAYS`  | Session lifetime (must be 7)                     | `7`                                         |
| `BCRYPT_COST`       | bcrypt work factor (min 12)                      | `12`                                        |
| `BCRYPT_DUMMY_HASH` | bcrypt hash for account-independent login timing | Generate with the command above             |

`.env.example` documents variable names. `.env.local` and all secrets are Git-ignored. Production configuration is supplied through Vercel environment settings with `MONGODB_URI` targeting MongoDB Atlas.

## API overview

All public endpoints use the `/api/v1` prefix. Successful responses use `{ "data": {} }`. Errors use `{ "error": { "code": "...", "message": "...", "details": {} }, "requestId": "..." }`.

### Authentication

| Method | Path                   | Success                | Errors                                         |
| ------ | ---------------------- | ---------------------- | ---------------------------------------------- |
| `POST` | `/api/v1/auth/sign-up` | `201` + session cookie | `400` invalid input, `409` duplicate email     |
| `POST` | `/api/v1/auth/login`   | `200` + session cookie | `400` invalid input, `401` invalid credentials |
| `POST` | `/api/v1/auth/logout`  | `204` clears cookie    | Safe to call with no session                   |
| `GET`  | `/api/v1/auth/me`      | `200` identity         | `401` missing/expired session                  |

### Orders

| Method   | Path                     | Success             | Errors                                                     |
| -------- | ------------------------ | ------------------- | ---------------------------------------------------------- |
| `GET`    | `/api/v1/orders?status=` | `200` order list    | `401` missing session                                      |
| `POST`   | `/api/v1/orders`         | `201` created order | `400` invalid input, `401` missing session                 |
| `GET`    | `/api/v1/orders/:id`     | `200` order detail  | `401` missing session, `404` not found                     |
| `PATCH`  | `/api/v1/orders/:id`     | `200` updated order | `400` invalid input, `404` not found, `409` payment-locked |
| `DELETE` | `/api/v1/orders/:id`     | `204` soft deleted  | `404` not found, `409` payment-locked                      |

### Payments

| Method | Path                          | Success                                    | Errors                                                                                                              |
| ------ | ----------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/orders/:id/payments` | `200` payment history                      | `401` missing session                                                                                               |
| `POST` | `/api/v1/orders/:id/payments` | `201` new payment, `200` idempotent replay | `400` invalid input, `401` missing session, `404` order not found, `409` idempotency key reused, `422` over-payment |

The `POST /api/v1/orders/:id/payments` endpoint requires an `Idempotency-Key` header. The body accepts `amountMinor` (positive integer, cents), `paymentDate` (`YYYY-MM-DD`), and optional `note` (max 1000 characters). All unsafe methods validate same-origin `Origin` and `Host` headers as CSRF defense.

### Error codes

| HTTP status | Error code               | Meaning                                                                  |
| ----------- | ------------------------ | ------------------------------------------------------------------------ |
| `400`       | `VALIDATION_ERROR`       | Zod validation failure                                                   |
| `400`       | `INVALID_JSON`           | Malformed JSON body                                                      |
| `400`       | `INVALID_ORIGIN`         | Same-origin check failed                                                 |
| `401`       | `INVALID_CREDENTIALS`    | Wrong email or password                                                  |
| `401`       | `UNAUTHORIZED`           | Missing, expired, or revoked session                                     |
| `404`       | `NOT_FOUND`              | Absent, deleted, or cross-merchant resource                              |
| `409`       | `DUPLICATE_EMAIL`        | Email already registered                                                 |
| `409`       | `PAYMENT_LOCKED`         | Order has payments, cannot modify                                        |
| `409`       | `IDEMPOTENCY_KEY_REUSED` | Same key used with different request body                                |
| `422`       | `OVERPAYMENT`            | Payment exceeds remaining balance (includes `maximumAllowedAmountMinor`) |
| `500`       | `INTERNAL_ERROR`         | Safe generic error; details logged internally                            |

## Status derivation rules

Order status is always derived from the amount paid and due date. It is never stored as a mutable field.

**Status precedence** (highest to lowest):

1. **`paid`** — `amountPaidMinor === totalMinor`. A fully paid order is always `paid`, even if paid after the due date.
2. **`overdue`** — `amountPaidMinor < totalMinor` AND current UTC date is strictly later than the due date.
3. **`partially_paid`** — `amountPaidMinor > 0` AND current UTC date is on or before the due date.
4. **`pending`** — No payments recorded AND current UTC date is on or before the due date.

**Edge case:** An order that was `overdue` but is later paid in full becomes `paid`. Time alone can change status from `pending` or `partially_paid` to `overdue` without any write or audit event, because no persisted state changed.

**Date semantics:** All dates use UTC calendar-date `YYYY-MM-DD` values. An order becomes overdue only when the current UTC date is strictly later than its due date. The due date itself is not overdue.

## Order editability policy

An order is fully editable and deletable until its first payment is recorded. Once any payment exists (`paymentCount > 0`), the order becomes read-only — `PATCH` and `DELETE` return `409 PAYMENT_LOCKED`. Deletion is a soft delete through `deletedAt`; the order remains in the audit trail but is absent from normal reads.

This policy is enforced atomically at the database level: the `update` and `softDelete` MongoDB operations include `paymentCount: 0` in their query filter, closing the TOCTOU race where a concurrent payment could lock the order between the read check and the write.

## Payment transaction and concurrency approach

Payments are stored in a separate immutable `payments` collection. Each order document maintains a Payments-owned summary projection (`amountPaidMinor` and `paymentCount`) for efficient reads and atomic locking.

Recording a payment uses a MongoDB multi-document transaction that atomically:

1. Claims the idempotency key (unique index on `merchantId + operation + key`).
2. Reads the order snapshot for status evaluation.
3. Conditionally reserves the order balance via `findOneAndUpdate` with a `$expr` guard: `amountPaidMinor + requestedAmountMinor <= totalMinor`.
4. On success: inserts the immutable payment, writes the audit event, stores the success response in the idempotency record, and commits.
5. On insufficient balance: writes a rejection audit event, stores the `422 OVERPAYMENT` outcome in the idempotency record, and commits (no payment created, no order summary change).

Concurrent full-payment commands compete at the conditional reservation. Only one can reserve the remaining balance. The transaction retry mechanism makes the losing command observe the updated balance and return `422`.

## Idempotency

Every `POST /api/v1/orders/:id/payments` request requires an `Idempotency-Key` header. The system stores a hash of the normalized request body alongside the key.

- **Same key + same body:** Returns the original response with `200` status (not `201`). No second payment is created.
- **Same key + different body:** Returns `409 IDEMPOTENCY_KEY_REUSED`. The original outcome is preserved.
- **New key:** Processes the payment normally, returns `201`.

The idempotency record persists the sanitized HTTP outcome for safe replay, even across server restarts.

## Audit approach

Audit events are written for every state-changing operation:

- **Identity:** sign-up, login, logout, session revocation.
- **Orders:** create, update, soft delete.
- **Payments:** record succeeded, record rejected.

Payment audit events include actor, merchant, order, payment ID, amount, timestamp, status before, status after, and rejection code (for rejections). Audit events never contain passwords, session tokens, raw idempotency keys, or unrelated request data.

## Assumptions and trade-offs

- **One user = one merchant:** The initial assignment maps one authenticated account to one merchant tenant. Multi-user merchant membership is a production follow-up.
- **Single currency:** All amounts use one configured display currency. Multi-currency is out of scope.
- **No pagination:** The dashboard lists all active orders without pagination. Cursor pagination is a production improvement.
- **Integer minor units:** All monetary values are integers in cents (e.g. 100000 = $1,000.00). No floating-point arithmetic is used anywhere.
- **Server-side status derivation:** Status is computed on every read using the Order Status evaluator, not stored. This guarantees correctness but means status can change with time alone.
- **Payment form uses cents:** The UI accepts amounts in minor units (cents) to match the API contract. A dollars/cents input is a UX improvement.
- **Opaque session tokens:** Sessions use database-backed opaque tokens (SHA-256 hashed in the database) rather than JWTs, enabling server-side revocation.
- **Same-origin only:** The API does not enable CORS. The frontend and API share one Next.js origin. Cross-origin clients are not supported.
- **No payment edits or refunds:** Payments are immutable. Refunds are a separate future workflow.

## What we would improve before production

- **Cursor pagination** on the dashboard with an indexed read projection.
- **Dollar/cents input** in the payment form instead of raw minor units.
- **Rate limiting** on authentication and payment endpoints.
- **Password reset and email verification** flows.
- **Multi-user merchant membership** with role-based authorization.
- **Observability:** structured logging, metrics, and alerting integration.
- **Database backup verification** and automated secret rotation.
- **OpenAPI documentation** published via Mintlify (Module 08 spec).
- **Custom 404 page** (`not-found.tsx`) instead of the Next.js default.
- **Clock injection in read paths:** `toOrderResult`/`toOrderSummary` currently use `new Date()` for `asOfUtcDate` in some paths; injecting the `Clock` port would make status derivation fully deterministic in tests.

## Sample verification flow

The assignment scenario can be verified through the UI or API:

### Via the UI

1. Sign up at `/sign-up` with a valid email and password (min 12 characters).
2. On the dashboard, create an order: customer "Acme Corp", due date 7 days out, 1 line item with description "Widget", quantity 2, unit price 50000 (cents). Total = $1,000.00.
3. Click the order to view detail. Status should be `pending`, amount due $1,000.00.
4. Record a payment of 40000 cents ($400.00). Status becomes `partially_paid`, amount due $600.00.
5. Record a payment of 60000 cents ($600.00). Status becomes `paid`, amount due $0.00.
6. The payment form disappears (no balance remaining). Attempting another payment is not possible from the UI.

### Via the API

```bash
# Sign up and capture session cookie
curl -c cookies.txt -X POST http://localhost:3000/api/v1/auth/sign-up \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"email":"test@example.com","password":"correcthorse1"}'

# Create a $1,000 order (2 x $5.00 = $10.00 in cents: 2 x 50000 = 100000)
curl -b cookies.txt -X POST http://localhost:3000/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"customer":"Acme Corp","dueDate":"2026-08-16","lineItems":[{"description":"Widget","quantity":2,"unitPriceMinor":50000}]}'

# Record $400 payment
curl -b cookies.txt -X POST http://localhost:3000/api/v1/orders/<ORDER_ID>/payments \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -H "Idempotency-Key: key-1" \
  -d '{"amountMinor":40000,"paymentDate":"2026-08-09"}'

# Record $600 payment
curl -b cookies.txt -X POST http://localhost:3000/api/v1/orders/<ORDER_ID>/payments \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -H "Idempotency-Key: key-2" \
  -d '{"amountMinor":60000,"paymentDate":"2026-08-09"}'

# Attempt $1 over-payment (should return 422)
curl -b cookies.txt -X POST http://localhost:3000/api/v1/orders/<ORDER_ID>/payments \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -H "Idempotency-Key: key-3" \
  -d '{"amountMinor":100,"paymentDate":"2026-08-09"}'
```

## Testing

The project uses four test layers:

| Layer                        | Tool                 | Coverage                                                                                            |
| ---------------------------- | -------------------- | --------------------------------------------------------------------------------------------------- |
| Domain unit tests            | Vitest               | Money computation, status precedence, date validation, schema validation                            |
| Module and integration tests | Vitest + MongoDB     | Authentication, ownership isolation, order locking, payment transactions, idempotency, audit events |
| API contract tests           | Vitest + NextRequest | All `/api/v1` endpoints, error envelopes, auth, CSRF-origin checks                                  |
| End-to-end tests             | Playwright           | Sign-up/login, protected routes, order creation, payment flow, over-payment rejection               |

Run tests:

```bash
npm test           # Vitest unit + integration + API tests
npm run test:e2e   # Playwright browser tests (requires npm run dev)
```

CI runs the full quality gate: format check -> lint -> typecheck -> unit/integration tests -> build -> Playwright.

## Engineering documentation

- [Agent instructions](AGENTS.md)
- [Domain context](CONTEXT.md)
- Module designs: [Authentication](docs/superpowers/specs/2026-08-08-01-authentication-design.md), [Orders](docs/superpowers/specs/2026-08-08-02-orders-design.md), [Order Status](docs/superpowers/specs/2026-08-08-03-order-status-design.md), [Payments](docs/superpowers/specs/2026-08-08-04-payments-design.md), [Dashboard](docs/superpowers/specs/2026-08-08-05-dashboard-design.md), [REST API](docs/superpowers/specs/2026-08-08-06-rest-api-design.md), [Delivery and Quality](docs/superpowers/specs/2026-08-08-07-delivery-and-quality-design.md)
- [Architecture decisions](docs/adr/README.md)
- [Agent-development guidance](docs/agents/domain.md)

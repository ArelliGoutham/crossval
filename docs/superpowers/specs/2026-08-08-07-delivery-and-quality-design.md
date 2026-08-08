# Module 07: Delivery and Quality

## Status

Approved for documentation. No implementation has begun.

## Purpose

Define the quality gates, local development environment, configuration contract, deployment target, verification evidence, and README requirements for the Orders and Settlements assignment.

## Testing strategy

- Use Vitest for TDD-driven domain, module, and API contract tests.
- Use Playwright for browser-level end-to-end tests.
- Follow red, green, refactor for every business rule.
- Run transaction and payment-concurrency tests against a real MongoDB replica set, never a mocked transaction implementation.

Required test layers:

| Layer | Evidence |
| --- | --- |
| Domain unit tests | Money, totals, status precedence, due-date semantics, validation. |
| Module and integration tests | Authentication, ownership isolation, order locking, payment transactions, idempotency, audit events. |
| API contract tests | `/api/v1` validation, errors, auth, CSRF-origin checks, and response envelopes. |
| End-to-end tests | Sign-up/login, protected dashboard, order creation, partial/full payment, and over-payment rejection. |

The end-to-end scenario must include the assignment flow: create a $1,000 order, record $400, record $600, then reject a further $1 payment.

## Local development and test database

Docker Compose provisions a single-node MongoDB replica set named `rs0`. Initialization must run `rs.initiate()` so the local database supports the same multi-document transactions used by Payments.

A standalone MongoDB container is not acceptable because it cannot execute the approved multi-document transaction design.

Local development and tests select their databases through environment values. Test runs use an isolated database name and clean only that explicit test database between suites.

## Configuration

Configuration is externalized and validated once at process startup with Zod.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Local replica-set or Atlas connection URI. |
| `MONGODB_DB_NAME` | Application database name. |
| `APP_ORIGIN` | Canonical application origin for cookies and origin validation. |
| `SESSION_TTL_DAYS` | Session lifetime. |
| `BCRYPT_COST` | bcrypt work factor; production baseline is 12. |

`.env.example` documents variable names and safe placeholder values. `.env.local` and all secrets are Git-ignored. Production configuration is supplied through Vercel environment settings, with `MONGODB_URI` targeting MongoDB Atlas.

## CI quality gate

On GitHub push and pull request, CI runs:

```text
format check -> lint -> typecheck -> unit/integration tests -> build -> Playwright
```

CI provisions the same MongoDB replica-set topology required by payment transaction tests. A failed quality gate blocks release readiness.

## Deployment

- Deploy the Next.js application to Vercel.
- Use MongoDB Atlas for production storage and transactions.
- Atlas must provide replica-set-capable transactions.
- Keep production credentials solely in the deployment provider's environment settings.

Before submission, verify against the deployed URL:

1. Sign-up and login.
2. Protected dashboard redirect behavior.
3. Order creation and detail display.
4. Partial and full payments.
5. Rejected over-payment and idempotent replay.

## README and submission evidence

The final README must include:

- Prerequisites, Docker commands, and step-by-step local setup.
- Required environment variables.
- Main `/api/v1` endpoints and response/error conventions.
- Status derivation, UTC due-date semantics, and editability policy.
- Payment transaction, concurrency, idempotency, and audit approach.
- Assumptions, trade-offs, production improvements, and deferred features.
- Public deployed URL and the assignment sample verification flow.
- API documentation URL and instructions to import the OpenAPI contract into Postman.

The submission includes the repository URL, deployed URL, and optionally a short walkthrough video.

## Deferred work

Infrastructure-as-code, observability service integration, alerting, load testing, secret rotation automation, database backup verification, and a formal release pipeline are production follow-ups. API reference documentation is specified by Module 08.

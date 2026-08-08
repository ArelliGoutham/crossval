# Module 08: API Documentation

## Status

Approved for documentation. No implementation has begun.

## Purpose

Publish an accurate, developer-friendly reference for the public `/api/v1` contract. It must provide copyable requests and a Postman-ready API definition without weakening the approved cookie-session security model.

## Deployment topology

- The Next.js application and `/api/v1` API deploy to Vercel.
- Mintlify deploys the documentation from this repository through its GitHub integration.
- Production uses separate origins, for example `app.<domain>` for the application and `docs.<domain>` for documentation. Mintlify's assigned `.mintlify.site` URL is acceptable for the assignment.
- A source change to the documentation or OpenAPI contract is committed in this repository; Mintlify performs its own documentation deployment. The docs are not served by the Vercel application.

## Canonical contract

The source-controlled OpenAPI 3.1 document is the public API-reference contract. It is versioned with the application and models only the routes, schemas, headers, status codes, and envelopes approved by Module 06.

Zod remains the source of truth for runtime validation and TypeScript inference. The implementation must use one explicit, tested schema-to-OpenAPI projection or adapter; route handlers and Mintlify pages must not independently re-state request or response shapes.

Any mismatch between a Zod public-boundary schema and its published OpenAPI projection is a defect. CI validates the OpenAPI document and runs API contract tests for the published examples.

## Mintlify content

Mintlify owns presentation only. It receives the OpenAPI document and adds concise guides for:

1. Overview, API base URL, versioning, and common response envelopes.
2. Browser session authentication and authorization boundaries.
3. Creating and managing orders.
4. Recording payments, including idempotency, concurrency, and over-payment errors.
5. Dashboard/order query filters and derived statuses.
6. Error codes, UTC dates, money minor units, and tenant isolation behavior.
7. Postman import and use.

Endpoint pages are generated from the OpenAPI contract. Configure Mintlify's API reference in its non-interactive simple display mode, with copyable cURL, JavaScript, and Python examples. This is intentionally an API reference rather than a browser-based API client.

## Authentication in documentation

The API remains exclusively cookie-session authenticated. Documentation must not introduce a bearer token, API key, or a weaker testing credential just to support an in-browser playground.

The authentication guide distinguishes two supported client contexts:

- Browsers use the sign-up/login UI and the `HttpOnly`, host-only session cookie managed by the browser.
- Postman users first call the login endpoint against the application origin. Postman's domain-scoped cookie jar then supplies the returned cookie to later requests against that same origin.

Copyable examples for public authentication endpoints include full cURL commands. Protected endpoint examples explain the required authenticated session but do not instruct users to extract or paste an `HttpOnly` cookie value. The documentation site itself never attempts to reuse the application's cookie.

## Postman workflow

The Mintlify site links directly to the versioned `openapi.yaml` and gives short import instructions. Importing that file into Postman generates a collection from the same published contract.

The documentation provides a non-secret `baseUrl` environment variable example and a login-first workflow. It explains that `Idempotency-Key` is mandatory for payment creation and that each logically new payment needs a unique key; retries of the same request retain the same key.

No committed Postman environment contains cookies, passwords, tokens, or production-specific values. A generated Postman collection is not required initially because Postman can import the OpenAPI document; if added later, it must be generated from that document in CI.

## Boundaries and security

- Documentation describes contracts; it does not import application internals or query the database.
- The OpenAPI adapter only consumes public Zod schemas and public API metadata, not repositories or use-case implementations.
- Examples use placeholders and non-sensitive test values only.
- The production API retains same-origin protections for unsafe cookie-authenticated requests. Cross-origin browser calls from the Mintlify site are not supported.
- Error examples expose only the approved safe envelope and never audit details, credentials, raw session values, or internal errors.

## Test-first acceptance criteria

Write failing tests before implementation for:

1. The generated OpenAPI document is valid OpenAPI 3.1 and contains every approved `/api/v1` operation.
2. Each published request/response schema matches the corresponding public Zod boundary schema.
3. The payment operation declares the required `Idempotency-Key` header and the documented `200`, `201`, `409`, and `422` outcomes.
4. The authentication and security guides do not publish credentials, raw session-cookie values, or unsupported cross-origin usage.
5. Mintlify local validation succeeds and generated reference pages resolve all documented operations.
6. A clean Postman import of the OpenAPI document retains the API base URL variable and endpoint definitions.

## Deferred work

An authenticated Mintlify API playground, API keys, third-party programmatic API access, SDK generation, multiple client languages beyond the initial three, and automated collection publishing are out of scope.

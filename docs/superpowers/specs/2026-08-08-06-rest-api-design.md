# Module 06: REST API

## Status

Approved for documentation. No implementation has begun.

## Purpose

Expose the approved Authentication, Orders, Payments, and Dashboard contracts through a stable, versioned HTTP API.

## Scope

This module owns Next.js route-handler adaptation: request IDs, authentication, Zod parsing, same-origin validation for unsafe requests, response envelopes, and domain-error mapping. It does not contain business rules, persistence queries, or duplicate domain validation.

## Versioning

All public routes use the `/api/v1` prefix. Additive optional fields may be added to v1. Breaking changes require a new version prefix such as `/api/v2`.

## Endpoints

| Method | Path | Delegates to |
| --- | --- | --- |
| `POST` | `/api/v1/auth/sign-up` | Authentication sign-up. |
| `POST` | `/api/v1/auth/login` | Authentication login. |
| `POST` | `/api/v1/auth/logout` | Authentication logout. |
| `GET` | `/api/v1/auth/me` | Authentication current identity. |
| `GET` | `/api/v1/orders?status=` | Dashboard order-list query. |
| `POST` | `/api/v1/orders` | Orders creation. |
| `GET` | `/api/v1/orders/:id` | Dashboard order-detail query. |
| `PATCH` | `/api/v1/orders/:id` | Orders update. |
| `DELETE` | `/api/v1/orders/:id` | Orders soft deletion. |
| `GET` | `/api/v1/orders/:id/payments` | Payments history. |
| `POST` | `/api/v1/orders/:id/payments` | Payments recording. |

## Response contract

Successful JSON responses use:

```json
{ "data": {} }
```

Errors use:

```json
{
  "error": {
    "code": "OVERPAYMENT",
    "message": "Payment exceeds the remaining balance.",
    "details": { "maximumAllowedAmountMinor": 60000 }
  },
  "requestId": "..."
}
```

`204 No Content` responses have no body. Route handlers include a request ID in error logs and error responses; it is not a session identifier.

## Error mapping

| Status | Meaning |
| --- | --- |
| `400` | Zod validation failure. |
| `401` | Missing, expired, revoked, or invalid session. |
| `404` | Absent, deleted, or inaccessible resource. |
| `409` | Payment-locked order, idempotency conflict, or unresolved in-progress idempotency key. |
| `422` | Over-payment; details include the maximum allowed amount. |
| `500` | Safe generic internal-error response; detailed cause is logged internally. |

## Security and validation

- Every path parameter, query parameter, body, and required header is validated with Zod.
- The route handler obtains `merchantId` and actor identity only from Authentication's `requireMerchant` contract.
- Payment recording requires an `Idempotency-Key` header.
- Unsafe cookie-authenticated methods validate same-origin `Origin` and `Host` values as CSRF defense.
- Frontend and API share one Next.js origin; CORS is not enabled.

## Boundary

Handlers convert HTTP input to a public module contract and convert the result or domain error to the documented response. They must not import repositories, MongoDB collections, or private module implementations.

## Test-first acceptance criteria

Write failing tests before implementation for:

1. Every endpoint validates request input and returns the documented envelope.
2. Missing sessions return `401`; cross-merchant resource requests return `404`.
3. Payment routes require an idempotency key and preserve `201` versus `200` replay semantics.
4. Over-payment returns `422` with an actionable maximum amount.
5. Unsafe cross-origin requests are rejected.
6. Each handler delegates to the correct public module contract without persistence-specific knowledge.

## Deferred work

OpenAPI publication, rate limiting, API keys, third-party CORS clients, webhooks, ETags, and a v2 contract are out of scope.

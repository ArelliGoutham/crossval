# Module 01: Authentication

## Status

Approved for documentation. No implementation has begun.

## Purpose

Authenticate users by email and password, create and revoke sessions, and provide a trusted merchant identity to every protected module.

## Scope

This module owns sign-up, login, logout, and current-session lookup. It does not own orders, payments, authorization roles, password reset, email verification, SSO, or multi-user merchant membership.

## Decisions

- Use email and password credentials.
- Hash passwords with `bcrypt`. bcrypt generates and embeds a unique salt in every stored hash.
- Use a bcrypt cost factor of 12. The value is externalized through validated configuration; production must not use a weaker value.
- Use opaque, database-backed session tokens rather than JWTs.
- Store the raw session token only in an HTTP-only cookie. Store only a SHA-256 hash of that token in the database.
- A session lasts seven days unless revoked or expired.
- In this initial assignment, a user is the sole user of one merchant tenant. Signup generates a stable `merchantId` for that user.

## Domain model

### User

| Field | Meaning |
| --- | --- |
| `id` | Immutable user identifier. |
| `merchantId` | Tenant identifier used for all ownership checks. |
| `email` | Trimmed, lower-cased, unique email address. |
| `passwordHash` | bcrypt hash; never returned, logged, or placed in a cookie. |
| `createdAt` / `updatedAt` | Audit timestamps. |

### Session

| Field | Meaning |
| --- | --- |
| `id` | Immutable session identifier. |
| `tokenHash` | SHA-256 hash of the opaque browser token; unique. |
| `userId` / `merchantId` | The authenticated identity. |
| `expiresAt` | Expiry time; indexed for expiry cleanup. |
| `createdAt` / `revokedAt` | Session audit fields. |

`users.email` and `sessions.tokenHash` require unique indexes. `sessions.expiresAt` requires a TTL index.

## Public contract

The Authentication module exposes use cases, not persistence details:

- `signUp(input)` creates a user, merchant identity, audit event, and session.
- `login(input)` verifies credentials and creates a session.
- `logout(sessionToken)` revokes the corresponding session.
- `requireMerchant(sessionToken)` returns `{ userId, merchantId }` or an authorization error.

The module depends on the following ports:

- `UserRepository`
- `SessionRepository`
- `PasswordHasher`
- `SessionTokenGenerator`
- `Clock`
- `AuditLog`

MongoDB, bcrypt, cookies, and Next.js route handlers are adapters. Orders, Payments, Dashboard, and API modules may use only the Authentication public contract.

## Validation and HTTP boundary

Zod schemas are the single source of truth for email/password request validation and inferred types.

| Endpoint | Success | Failure behaviour |
| --- | --- | --- |
| `POST /api/auth/sign-up` | `201`, session cookie set | `400` invalid input; `409` duplicate email. |
| `POST /api/auth/login` | `200`, session cookie set | `400` invalid input; generic `401` invalid credentials. |
| `POST /api/auth/logout` | `204`, session revoked and cookie cleared | Safe to call when no valid session exists. |
| `GET /api/auth/me` | `200` authenticated identity | `401` absent, expired, or revoked session. |

Passwords must be at least 12 characters. Errors never reveal whether a login email exists, and responses never expose password hashes or session tokens.

## Cookie policy

The response sets one opaque session cookie with these attributes:

- `HttpOnly`
- `Secure` in production
- `SameSite=Lax`
- `Path=/`
- explicit expiry aligned with the server session expiry

The token is generated from cryptographically secure randomness. The browser sends it automatically; server-side code validates it through `requireMerchant` before any tenant-scoped operation.

## Auditability

Record successful sign-up, login, logout, and session revocation with timestamp, user ID when available, and merchant ID. Never audit raw passwords, password hashes, raw session tokens, or full credential payloads.

## Test-first acceptance criteria

Before implementation, write failing tests for:

1. Sign-up rejects invalid email and passwords shorter than 12 characters.
2. Sign-up stores a bcrypt hash rather than the plaintext password.
3. Duplicate normalized email is rejected.
4. Valid login creates an opaque session and correct cookie flags.
5. Invalid credentials receive the same generic error regardless of email existence.
6. Expired and revoked sessions cannot resolve a merchant identity.
7. Logout revokes the session and clears the cookie.
8. Protected callers receive only the authenticated `merchantId`, never a client-supplied tenant scope.

## Deferred work

Password reset, email verification, account lockout/rate limiting, roles, SSO, multi-user merchant membership, and device/session management are explicit production follow-ups, not take-home scope.

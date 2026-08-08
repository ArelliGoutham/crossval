# ADR 0003: Atomic identity commands and fixed session lifetime

## Context

Authentication changes several documents for one user-visible command. A successful sign-up writes a user, session, and audit event; login writes a session and audit event; logout revokes a session and writes revocation and logout audit events. A failure after any earlier write must not leave a partial authentication state.

The approved deployment topology already provides a MongoDB replica set. The session policy in the approved Authentication design is exactly seven days, and credential failures must not reveal whether an account exists through bcrypt work.

## Considered options

1. Keep independent repository and audit writes, relying on compensating cleanup after failures.
2. Put MongoDB transaction handling in the identity service.
3. Add an Identity transaction port whose Mongo adapter supplies transaction-bound identity persistence operations.

## Decision

Choose option 3. The identity service depends on an explicit transaction runner and transaction-scoped identity persistence port. Its Mongo adapter runs the callback in a MongoDB transaction and passes the client session only inside infrastructure adapters. Sign-up, successful login, and successful logout perform every mutable write and audit record in one transaction.

The configuration contract requires `SESSION_TTL_DAYS=7`, and the identity service owns the fixed seven-day expiration policy rather than accepting a configurable duration. A required configured bcrypt dummy hash is verified for a missing login account before the generic invalid-credentials result is returned.

## Consequences

- Identity persistence adapters need transaction-scoped variants, but MongoDB types remain private to infrastructure.
- Local and production MongoDB deployments must continue to support replica-set transactions.
- A failed identity command leaves no user, session, revocation, or audit fragment behind.
- Every login attempt performs bcrypt verification; the dummy hash is a secret-like configuration value and is never logged.

## Supersedes

This clarifies the Authentication module's approved atomicity and seven-day session decisions; it supersedes no prior ADR.

# ADR 0002: Version the public REST API

## Context

The repository requires explicit, stable, and versionable API contracts. Authentication, Orders, Payments, and Dashboard require HTTP exposure in the same Next.js application.

## Considered options

1. Use unversioned `/api/...` routes.
2. Use URL-versioned `/api/v1/...` routes.
3. Use media-type versioning through HTTP headers.

## Decision

Choose URL-versioned `/api/v1/...` routes.

## Consequences

- All public HTTP contracts have a visible stable version.
- Additive optional fields can be introduced in v1.
- Breaking changes require a new prefix such as `/api/v2`.
- Route paths are slightly longer, but clients and reviewers can see compatibility intent immediately.

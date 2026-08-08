# CrossVal Orders and Settlements

## Mission and scope

Build the Orders and Settlements take-home assignment as a deployable Next.js and TypeScript application. The assignment scope is authentication, merchant-owned orders, partial payments, derived order status, a REST API, dashboard and order detail views. Do not add AI features, accounting workflows, invoicing, refunds, exports, or other stretch goals unless explicitly approved.

No implementation work begins until the architecture and implementation plan are reviewed and approved.

## Start every task here

Before changing code, read `CONTEXT.md`, relevant ADRs under `docs/adr/`, and the documents in `docs/agents/`. Preserve the vocabulary and decisions recorded there. Raise an ADR before changing a cross-module contract, persistence model, authentication boundary, money representation, or status rule.

## Architecture rules

- Keep this repository a modular monolith. It deploys as one Next.js application but has strict internal module boundaries.
- Organize code by business module, not technical layer alone. Expected initial modules are identity, orders, payments, and dashboard/query.
- A module exposes an explicit public contract. Other modules depend only on that contract and never import private implementation, database models, or framework internals from it.
- Depend on interfaces and ports. Infrastructure implementations, such as MongoDB repositories, authentication sessions, clocks, and ID generators, must be swappable adapters.
- Keep route handlers and UI components thin. They adapt HTTP or user interaction to a module use case; they do not contain business rules.
- Prefer extension through new evaluators, policies, and adapters over rewriting established core flows.
- Keep modules single-purpose, cohesive, and small. Centralize shared rules, validation, and transformations instead of duplicating them.

## Domain and security invariants

- Tenant isolation is mandatory: every read and mutation is scoped by `merchantId`. Never accept a merchant identifier from an untrusted client as authorization.
- Treat the authenticated session as the source of merchant identity.
- Payments are immutable records. Every financial state change must leave an auditable record with actor and timestamp.
- Money uses integer minor units. Never use floating-point arithmetic for monetary values.
- Validate all public boundaries, especially HTTP input, environment configuration, and cross-module contracts.
- Use Zod as the single source of truth for runtime validation and inferred TypeScript types.
- Keep data models and API contracts explicit, stable, and versionable.
- Keep secrets out of source control and logs. Use least-privilege access and externalized configuration.

## Code quality and testing

- Use strict TypeScript. Do not use `any`; prefer `unknown` followed by narrowing.
- Core domain logic must be pure, deterministic, and independently testable.
- Apply TDD to all logic: write a failing test, make it pass with the smallest change, then refactor.
- Test business invariants, not implementation details. At minimum, cover line-item totals, status transitions, over-payment rejection, ownership isolation, and concurrent-payment protection.
- Make error responses consistent, actionable, and safe to expose.

## Documentation and delivery

- Record assumptions, status precedence, order editability, date semantics, concurrency approach, and production follow-ups in the README and ADRs where appropriate.
- The final repository must include setup steps, API overview, deployed URL, domain rules, assumptions, trade-offs, and production improvements.
- Do not create or close GitHub issues until a remote is configured and the user authorizes it.

## Agent skills

### Issue tracker

Issues and PRDs will live in GitHub Issues once a GitHub remote is configured. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the standard repository label vocabulary when GitHub Issues is enabled. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository with `CONTEXT.md` at the root and ADRs in `docs/adr/`. See `docs/agents/domain.md`.

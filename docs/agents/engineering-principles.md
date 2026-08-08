# Engineering code design principles

These principles are mandatory for all implementation work in this repository.

- Use a modular monolith with strict module boundaries.
- Communicate through interfaces, not direct concrete dependencies.
- Depend on abstractions and keep implementations swappable.
- Use Zod as the single source of truth for validation and inferred types.
- Keep core logic pure, deterministic, and easy to test.
- Apply TDD for all logic: red, green, refactor.
- Prefer open/closed extension: add behaviour through evaluators and adapters rather than rewrites.
- Keep modules single-purpose and small in responsibility.
- Centralize shared logic; do not duplicate rules, validation, or transformations.
- Enforce tenant isolation everywhere with merchant-scoped access.
- Make auditability first-class for state changes and external interactions.
- Keep configuration externalized; do not hardcode brand or environment-specific values.
- Use strict TypeScript and avoid `any`.
- Validate all public boundaries, especially API inputs and cross-module data.
- Keep data models and API contracts explicit, stable, and versionable.

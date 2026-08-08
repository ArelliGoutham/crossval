# Task 8 Report: Authentication workflow and logout verification

## Status

Complete — base delivery `100a9ef`; this fix round adds post-logout protected-route coverage and reconciles the SDD ledger.

## Regression evidence

The logout browser regression now signs up, logs out, confirms the login redirect, navigates to `/dashboard`, confirms the server redirects it back to `/login`, and confirms `GET /api/v1/auth/me` returns `401`.

### Red

After adding the `/dashboard` assertion, the protected-layout guard was temporarily removed without changing the committed implementation. The focused regression failed at the new assertion:

```text
Expected pattern: /\/login/
Received string:  "http://localhost:3000/dashboard"
tests/e2e/auth.spec.ts:69
1 failed
```

The guard was then restored exactly.

### Green

```text
npm run test:e2e -- --grep "logout clears access"
1 passed (6.0s)
```

## Quality gate

The prescribed chained command cannot proceed past its first command:

```text
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e

npm run format:check
exit 1
Code style issues found in 27 files. Run Prettier with --write to fix.
```

The format blocker is pre-existing, repository-wide Prettier drift. It includes the eight immutable task briefs, the plan and approved module designs, `docs/agents/triage-labels.md`, `eslint.config.mjs`, `next-env.d.ts`, four existing authentication route handlers, `src/components/auth/credentials-form.tsx`, `src/modules/identity/infrastructure/mongo-audit-log.ts`, `tests/api/auth.test.ts`, and `tsconfig.json`. This Task 8 fix did not modify those files, and strict scope leaves them untouched.

The remaining commands were run independently after the format-check blocker:

```text
npm run lint
exit 0

npm run typecheck
exit 0

npm test
Test Files  9 passed (9)
Tests  44 passed (44)

npm run build
exit 0
Compiled successfully
Generating static pages using 7 workers (10/10)

npm run test:e2e
6 passed (10.5s)
```

`next-env.d.ts` was observed after build and browser verification. It is clean at handoff, so no separate generated-metadata commit is needed.

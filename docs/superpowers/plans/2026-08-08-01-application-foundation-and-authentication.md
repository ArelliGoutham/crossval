# Application Foundation and Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deployable Next.js foundation and the approved email/password, merchant-scoped, opaque-session Authentication module.

**Architecture:** A single Next.js application hosts pages and `/api/v1` route handlers. The `identity` module exposes use cases and types through its public entry point; MongoDB, bcrypt, cookies, randomness, the clock, and audit persistence remain swappable adapters behind ports. Authentication establishes the merchant identity that later modules will consume only through `requireMerchant`.

**Tech Stack:** Next.js App Router, React, strict TypeScript, Zod, MongoDB Node.js driver, bcrypt, Vitest, Playwright, Docker Compose, ESLint, Prettier.

## Global Constraints

- Use strict TypeScript; do not use `any`.
- Zod is the single source of truth for public validation and inferred types.
- Store money as integer minor units when later modules introduce money; do not introduce floating-point money helpers here.
- Tenant identity originates only from the authenticated session, never client input.
- Passwords use bcrypt with a Zod-validated, externalized cost of at least `12` in production.
- Raw session tokens exist only in the `HttpOnly` cookie; MongoDB stores only their SHA-256 hash.
- Authentication audits sign-up, login, logout, and session revocation without credentials, hashes, or raw tokens.
- Apply red, green, refactor for every behavior in this plan.
- Keep the app and API on one origin; unsafe cookie-authenticated routes validate `Origin` and `Host`.
- Commit each completed task with the message shown in that task.

---

## File structure

| Path | Responsibility |
| --- | --- |
| `src/app/` | Thin App Router pages, route handlers, and route protection adapters. |
| `src/modules/identity/public.ts` | The only import surface available to other modules. |
| `src/modules/identity/domain/` | Pure identity types, Zod schemas, errors, and port definitions. |
| `src/modules/identity/application/` | Sign-up, login, logout, and merchant-resolution use cases. |
| `src/modules/identity/infrastructure/` | MongoDB repositories, bcrypt, crypto token/hash, clock, and audit adapters. |
| `src/shared/` | Validated configuration, Mongo client lifecycle, request/response helpers, and shared IDs. |
| `tests/` | Unit, integration, API, and browser tests, organized by matching module. |
| `docker-compose.yml` | Local replica-set MongoDB required by later payment transactions. |

### Task 1: Establish the Next.js, TypeScript, and test foundation

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `prettier.config.mjs`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `tests/unit/smoke.test.ts`

**Interfaces:**
- Consumes: no application interfaces.
- Produces: `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run test:e2e` commands for all later tasks.

- [ ] **Step 1: Write the failing smoke test**

```ts
// tests/unit/smoke.test.ts
import { expect, test } from 'vitest';

test('test runner is configured', () => {
  expect(process.env.NODE_ENV).toBe('test');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/smoke.test.ts`

Expected: failure because the package scripts and Vitest configuration do not exist.

- [ ] **Step 3: Add the minimal application and tool configuration**

Create a strict Next.js TypeScript app with these required scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

Configure TypeScript with `"strict": true`, `"noUncheckedIndexedAccess": true`, and a `@/*` alias for `src/*`. Add a minimal root layout and landing page that links to `/login` and `/sign-up`; do not add dashboard or order behavior yet.

- [ ] **Step 4: Run foundation verification**

Run: `npm test -- tests/unit/smoke.test.ts && npm run typecheck && npm run lint && npm run build`

Expected: all commands exit `0`.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json next.config.ts eslint.config.mjs prettier.config.mjs vitest.config.ts playwright.config.ts src/app tests/unit/smoke.test.ts
git commit -m "chore: establish Next.js application foundation"
```

### Task 2: Add validated runtime configuration and local MongoDB replica set

**Files:**
- Create: `src/shared/config/environment.ts`
- Create: `src/shared/config/environment.test.ts`
- Create: `src/shared/mongodb/client.ts`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `docker-compose.yml`
- Create: `docker/mongo-init.sh`
- Modify: `README.md`

**Interfaces:**
- Consumes: the application scripts from Task 1.
- Produces: `loadEnvironment(input: NodeJS.ProcessEnv): AppEnvironment` and `getMongoClient(): Promise<MongoClient>`.

- [ ] **Step 1: Write failing configuration tests**

```ts
import { describe, expect, test } from 'vitest';
import { loadEnvironment } from '@/shared/config/environment';

const validEnvironment = {
  MONGODB_URI: 'mongodb://localhost:27017/?replicaSet=rs0',
  MONGODB_DB_NAME: 'crossval',
  APP_ORIGIN: 'http://localhost:3000',
  SESSION_TTL_DAYS: '7',
  BCRYPT_COST: '12',
} as NodeJS.ProcessEnv;

describe('loadEnvironment', () => {
  test('parses valid externalized configuration', () => {
    expect(loadEnvironment(validEnvironment).bcryptCost).toBe(12);
  });

  test('rejects bcrypt cost below twelve', () => {
    expect(() => loadEnvironment({ ...validEnvironment, BCRYPT_COST: '11' })).toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/shared/config/environment.test.ts`

Expected: failure because `loadEnvironment` does not exist.

- [ ] **Step 3: Implement configuration and replica-set setup**

Define one Zod object that validates and transforms `MONGODB_URI`, `MONGODB_DB_NAME`, `APP_ORIGIN` (URL), `SESSION_TTL_DAYS` (positive integer), and `BCRYPT_COST` (integer minimum `12`). Return a frozen typed `AppEnvironment`.

Implement `getMongoClient` as a cached MongoDB Node.js driver connection created from validated config; export neither a collection nor a module-specific repository from `src/shared`.

Create Docker Compose for a single MongoDB instance started with `--replSet rs0`, and an idempotent init script:

```sh
mongosh --host mongo:27017 --eval 'try { rs.status() } catch (_) { rs.initiate({_id:"rs0",members:[{_id:0,host:"mongo:27017"}]}) }'
```

Add safe placeholders to `.env.example`, ignore `.env.local`, `.env.test.local`, `node_modules`, `.next`, and Playwright output. Document `docker compose up -d`, replica-set readiness, and local environment setup in the README.

- [ ] **Step 4: Run configuration and container verification**

Run: `npm test -- src/shared/config/environment.test.ts && docker compose up -d && docker compose exec mongo mongosh --quiet --eval 'rs.status().set'`

Expected: tests pass and Mongo prints `rs0`.

- [ ] **Step 5: Commit**

```bash
git add src/shared .env.example .gitignore docker-compose.yml docker README.md
git commit -m "chore: add validated configuration and local Mongo replica set"
```

### Task 3: Define identity domain contracts, validation, and errors

**Files:**
- Create: `src/modules/identity/domain/schemas.ts`
- Create: `src/modules/identity/domain/types.ts`
- Create: `src/modules/identity/domain/ports.ts`
- Create: `src/modules/identity/domain/errors.ts`
- Create: `src/modules/identity/domain/schemas.test.ts`
- Create: `src/modules/identity/public.ts`

**Interfaces:**
- Consumes: Zod and `AppEnvironment` conventions from Task 2.
- Produces: `signUpInputSchema`, `loginInputSchema`, `SignUpInput`, `LoginInput`, `AuthenticatedMerchant`, `UserRepository`, `SessionRepository`, `PasswordHasher`, `SessionTokenGenerator`, `Clock`, `AuditLog`, and typed identity errors.

- [ ] **Step 1: Write failing schema tests**

```ts
import { expect, test } from 'vitest';
import { signUpInputSchema } from '@/modules/identity/domain/schemas';

test('normalizes email and accepts a twelve-character password', () => {
  expect(signUpInputSchema.parse({ email: '  USER@Example.COM ', password: 'correcthorse1' })).toEqual({
    email: 'user@example.com',
    password: 'correcthorse1',
  });
});

test('rejects passwords shorter than twelve characters', () => {
  expect(signUpInputSchema.safeParse({ email: 'user@example.com', password: 'short' }).success).toBe(false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/modules/identity/domain/schemas.test.ts`

Expected: failure because the schemas do not exist.

- [ ] **Step 3: Implement the public domain boundary**

Define one shared credentials Zod schema that trims and lowercases a valid email and accepts a password with at least twelve characters. Derive both input types with `z.infer`.

Define ports with explicit method signatures, including:

```ts
export interface UserRepository {
  findByNormalizedEmail(email: string): Promise<StoredUser | null>;
  insert(user: NewStoredUser): Promise<StoredUser>;
}

export interface SessionRepository {
  insert(session: NewStoredSession): Promise<void>;
  findActiveByTokenHash(tokenHash: string, now: Date): Promise<StoredSession | null>;
  revokeByTokenHash(tokenHash: string, revokedAt: Date): Promise<void>;
}
```

Use an `IdentityError` discriminated union or typed error class with `invalid_credentials`, `duplicate_email`, and `unauthorized` codes. Export only approved types, schemas, use-case interfaces, and error types from `public.ts`; do not export internal adapter classes.

- [ ] **Step 4: Run domain verification**

Run: `npm test -- src/modules/identity/domain/schemas.test.ts && npm run typecheck`

Expected: both commands exit `0`.

- [ ] **Step 5: Commit**

```bash
git add src/modules/identity/domain src/modules/identity/public.ts
git commit -m "feat: define identity domain contracts"
```

### Task 4: Implement swappable identity infrastructure adapters and audit persistence

**Files:**
- Create: `src/modules/identity/infrastructure/mongo-user-repository.ts`
- Create: `src/modules/identity/infrastructure/mongo-session-repository.ts`
- Create: `src/modules/identity/infrastructure/mongo-audit-log.ts`
- Create: `src/modules/identity/infrastructure/bcrypt-password-hasher.ts`
- Create: `src/modules/identity/infrastructure/crypto-session-token-generator.ts`
- Create: `src/modules/identity/infrastructure/system-clock.ts`
- Create: `src/modules/identity/infrastructure/ensure-indexes.ts`
- Create: `tests/integration/identity/infrastructure.test.ts`

**Interfaces:**
- Consumes: Task 2 Mongo client/configuration and Task 3 ports.
- Produces: concrete adapters usable only by the identity composition root and `ensureIdentityIndexes(db)`.

- [ ] **Step 1: Write failing integration tests**

```ts
test('bcrypt adapter never returns the supplied password as its hash', async () => {
  const hash = await passwordHasher.hash('correcthorse1');
  expect(hash).not.toBe('correcthorse1');
  await expect(passwordHasher.verify('correcthorse1', hash)).resolves.toBe(true);
});

test('identity indexes enforce unique email and token hash and expire sessions', async () => {
  await ensureIdentityIndexes(testDatabase);
  await expect(insertSameNormalizedEmailTwice()).rejects.toMatchObject({ code: 11000 });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/integration/identity/infrastructure.test.ts`

Expected: failure because adapters and index setup do not exist.

- [ ] **Step 3: Implement adapters with no framework leakage**

Use the MongoDB driver only in the infrastructure folder. Create unique indexes for `users.email` and `sessions.tokenHash`, and a TTL index for `sessions.expiresAt` with `expireAfterSeconds: 0`. Every lookup by session token hash filters `revokedAt: null` and `expiresAt: { $gt: now }`, so authorization remains correct before asynchronous TTL cleanup.

Generate opaque tokens with `randomBytes(32).toString('base64url')`; hash tokens with `createHash('sha256')`. Use bcrypt’s `hash` and `compare` APIs at configured cost. Audit documents must contain event name, timestamp, optional actor IDs, merchant ID when available, and safe metadata only.

- [ ] **Step 4: Run integration verification**

Run: `npm test -- tests/integration/identity/infrastructure.test.ts && npm run typecheck`

Expected: both commands exit `0` against the `rs0` test database.

- [ ] **Step 5: Commit**

```bash
git add src/modules/identity/infrastructure tests/integration/identity/infrastructure.test.ts
git commit -m "feat: add identity persistence and security adapters"
```

### Task 5: Implement and test the identity use cases

**Files:**
- Create: `src/modules/identity/application/identity-service.ts`
- Create: `src/modules/identity/application/identity-service.test.ts`
- Create: `src/modules/identity/application/test-doubles.ts`
- Modify: `src/modules/identity/public.ts`

**Interfaces:**
- Consumes: Task 3 ports/errors and Task 4 adapter behavior.
- Produces: `IdentityService` implementing `signUp`, `login`, `logout`, and `requireMerchant`.

- [ ] **Step 1: Write failing use-case tests using in-memory ports**

```ts
test('sign-up creates a merchant-owned user, session, and safe audit event', async () => {
  const result = await service.signUp({ email: 'merchant@example.com', password: 'correcthorse1' });
  expect(result.identity).toMatchObject({ merchantId: expect.any(String), userId: expect.any(String) });
  expect(audit.events).toContainEqual(expect.objectContaining({ type: 'identity.signed_up' }));
  expect(JSON.stringify(audit.events)).not.toContain('correcthorse1');
});

test('login presents the same invalid-credentials error for missing user and wrong password', async () => {
  await expect(service.login({ email: 'none@example.com', password: 'correcthorse1' })).rejects.toMatchObject({ code: 'invalid_credentials' });
  await expect(service.login({ email: 'merchant@example.com', password: 'wrongpassword' })).rejects.toMatchObject({ code: 'invalid_credentials' });
});

test('revoked and expired sessions cannot resolve a merchant', async () => {
  await expect(service.requireMerchant(revokedToken)).rejects.toMatchObject({ code: 'unauthorized' });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/modules/identity/application/identity-service.test.ts`

Expected: failure because `IdentityService` does not exist.

- [ ] **Step 3: Implement minimal orchestration**

Implement the service solely through its injected ports. `signUp` validates input, checks normalized email uniqueness, generates independent user and merchant IDs, hashes the password, writes the user, creates a seven-day session, records a safe audit event, and returns the raw token only to the HTTP adapter.

`login` uses a constant public error result for nonexistent users and mismatched passwords. `logout` hashes the supplied raw token, revokes its session when present, and remains idempotent. `requireMerchant` hashes the token, resolves an active session, and returns exactly `{ userId, merchantId }`.

- [ ] **Step 4: Run application verification**

Run: `npm test -- src/modules/identity/application/identity-service.test.ts && npm run typecheck`

Expected: both commands exit `0`.

- [ ] **Step 5: Commit**

```bash
git add src/modules/identity/application src/modules/identity/public.ts
git commit -m "feat: add identity authentication use cases"
```

### Task 6: Add HTTP adapters, composition root, cookies, and API contract tests

**Files:**
- Create: `src/modules/identity/infrastructure/create-identity-module.ts`
- Create: `src/shared/http/api-response.ts`
- Create: `src/shared/http/request-context.ts`
- Create: `src/shared/http/same-origin.ts`
- Create: `src/app/api/v1/auth/sign-up/route.ts`
- Create: `src/app/api/v1/auth/login/route.ts`
- Create: `src/app/api/v1/auth/logout/route.ts`
- Create: `src/app/api/v1/auth/me/route.ts`
- Create: `tests/api/auth.test.ts`

**Interfaces:**
- Consumes: `IdentityService` from Task 5 and public Zod schemas from Task 3.
- Produces: `/api/v1/auth/sign-up`, `/login`, `/logout`, and `/me` with approved response/cookie behavior.

- [ ] **Step 1: Write failing API contract tests**

```ts
test('sign-up returns 201 with an HttpOnly SameSite=Lax session cookie', async () => {
  const response = await request('POST', '/api/v1/auth/sign-up', validCredentials);
  expect(response.status).toBe(201);
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  expect(response.headers.get('set-cookie')).toContain('SameSite=Lax');
  expect(await response.json()).toEqual({ data: { user: expect.objectContaining({ email: 'merchant@example.com' }) } });
});

test('login does not reveal whether an email exists', async () => {
  expect(await login('missing@example.com', 'correcthorse1')).toMatchObject({ status: 401, body: { error: { code: 'INVALID_CREDENTIALS' } } });
  expect(await login('merchant@example.com', 'wrongpassword')).toMatchObject({ status: 401, body: { error: { code: 'INVALID_CREDENTIALS' } } });
});

test('unsafe requests with a foreign Origin are rejected', async () => {
  expect((await request('POST', '/api/v1/auth/logout', undefined, { Origin: 'https://attacker.example' })).status).toBe(400);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/api/auth.test.ts`

Expected: failure because the route handlers do not exist.

- [ ] **Step 3: Implement thin HTTP adaptation**

Create the identity composition root in the module infrastructure folder; it constructs adapters from validated shared configuration and returns the public `IdentityService` interface. Route handlers may import only this composition function and public identity schemas/types.

For success JSON return `{ data: ... }`; return `{ error: { code, message, details? }, requestId }` for errors. Set the session cookie with `httpOnly: true`, `sameSite: 'lax'`, `secure: environment.isProduction`, `path: '/'`, and an explicit expiry matching the server session. Logout clears the same cookie with an expired date and returns `204` without a body. `GET /me` returns only safe user/merchant identity.

For each `POST`, validate `Origin` equals `APP_ORIGIN` and `Host` matches the configured origin host before reading credentials or mutating state. Validate JSON input through the exported Zod schemas; malformed JSON is a `400` validation response.

- [ ] **Step 4: Run API verification**

Run: `npm test -- tests/api/auth.test.ts && npm run typecheck && npm run lint`

Expected: all commands exit `0`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api src/modules/identity/infrastructure/create-identity-module.ts src/shared/http tests/api/auth.test.ts
git commit -m "feat: expose versioned authentication API"
```

### Task 7: Add authentication screens and server-side route protection

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/sign-up/page.tsx`
- Create: `src/app/(app)/dashboard/page.tsx`
- Create: `src/app/(app)/orders/[id]/page.tsx`
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/auth/credentials-form.tsx`
- Create: `src/components/auth/credentials-form.test.tsx`
- Create: `tests/e2e/auth.spec.ts`

**Interfaces:**
- Consumes: API contracts from Task 6; the protected layout consumes only `requireMerchant` from identity public API.
- Produces: `/login`, `/sign-up`, protected `/dashboard`, protected `/orders/:id`, and redirect behavior.

- [ ] **Step 1: Write failing component and browser tests**

```ts
test('credentials form presents validation feedback before submitting an invalid password', async () => {
  render(<CredentialsForm mode="sign-up" />);
  await userEvent.type(screen.getByLabelText('Password'), 'short');
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByText('Password must contain at least 12 characters.')).toBeVisible();
});
```

```ts
test('unauthenticated visitors are redirected to login and authenticated users land on dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  await signUpThroughPage(page, 'merchant@example.com', 'correcthorse1');
  await expect(page).toHaveURL(/\/dashboard/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/components/auth/credentials-form.test.tsx && npm run test:e2e -- tests/e2e/auth.spec.ts`

Expected: failures because the pages, component, and route guard do not exist.

- [ ] **Step 3: Implement accessible pages and guards**

Build a reusable client-side credentials form that validates with the same public Zod schema, posts to the appropriate API endpoint, renders safe errors, and replaces the route with `/dashboard` after success. Never place tokens in React state, local storage, or client-visible props.

In the protected server layout, read the cookie server-side and call only `requireMerchant`; redirect absent/invalid sessions to `/login`. The initial dashboard and order-detail pages are intentional authenticated placeholders until Modules 02 and 05 implement their content. Auth pages redirect a valid session to `/dashboard`.

- [ ] **Step 4: Run UI verification**

Run: `npm test -- src/components/auth/credentials-form.test.tsx && npm run test:e2e -- tests/e2e/auth.spec.ts && npm run build`

Expected: all commands exit `0`.

- [ ] **Step 5: Commit**

```bash
git add src/app src/components/auth tests/e2e/auth.spec.ts
git commit -m "feat: add authentication screens and route protection"
```

### Task 8: Verify the authentication vertical slice and document its local workflow

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-08-08-01-authentication-design.md` only if behavior required by the implementation differs from its approved text; otherwise do not modify it.

**Interfaces:**
- Consumes: the complete Tasks 1–7 vertical slice.
- Produces: repeatable local verification evidence and accurate developer setup documentation.

- [ ] **Step 1: Write a failing end-to-end regression case**

```ts
test('logout clears access to protected pages and API identity', async ({ page, request }) => {
  await signUpThroughPage(page, 'merchant@example.com', 'correcthorse1');
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);
  expect((await request.get('/api/v1/auth/me')).status()).toBe(401);
});
```

- [ ] **Step 2: Run the regression to verify it fails**

Run: `npm run test:e2e -- tests/e2e/auth.spec.ts -g "logout clears access"`

Expected: failure until the logout control and cookie-clearing behavior are connected end-to-end.

- [ ] **Step 3: Make the smallest compliant completion changes**

Add the protected-area logout control that calls `POST /api/v1/auth/logout` with same-origin credentials and navigates to `/login`. Add README instructions for local Mongo startup, environment configuration, sign-up/login/logout verification, cookie attributes, and the `GET /api/v1/auth/me` endpoint. Do not add unapproved account-management features.

- [ ] **Step 4: Run the complete authentication quality gate**

Run: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e`

Expected: every command exits `0`; retain command output in the implementation handoff.

- [ ] **Step 5: Commit**

```bash
git add README.md src/app tests/e2e/auth.spec.ts
git commit -m "docs: verify authentication local workflow"
```

## Plan self-review

- Spec coverage: all Module 01 decisions map to Tasks 2–8: validated configuration, bcrypt/salt, opaque hashed sessions, session expiry/revocation, user-to-merchant ownership, audited actions, Zod boundaries, cookie policy, API behavior, authentication pages, and protected-route behavior.
- Boundaries: Tasks 3–6 prevent other modules and route handlers from reaching MongoDB or concrete identity adapters directly.
- Deferred work: password reset, verification, rate limiting, SSO, roles, and multi-user merchant membership are not introduced.
- Placeholder scan: no unresolved placeholders remain; every task has exact files, interfaces, commands, expected results, and a commit.

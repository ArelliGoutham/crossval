# Task 2 Report: Validated Runtime Configuration and Local MongoDB Replica Set

## Status

DONE.

## Implementation

- Added `loadEnvironment(input: NodeJS.ProcessEnv): AppEnvironment` in `src/shared/config/environment.ts`.
  - One Zod schema validates `MONGODB_URI`, `MONGODB_DB_NAME`, `APP_ORIGIN`, `SESSION_TTL_DAYS`, and `BCRYPT_COST`.
  - Numeric values are coerced to integers; `SESSION_TTL_DAYS` must be positive and `BCRYPT_COST` must be at least 12.
  - External variable names are transformed to typed camel-case values and the returned object is frozen.
- Added the cached `getMongoClient(): Promise<MongoClient>` lifecycle adapter in `src/shared/mongodb/client.ts`.
  - The shared module exports no collection or module-specific repository.
- Added configuration tests covering valid parsing, bcrypt-cost rejection, and invalid URI/name/TTL values.
- Added `.env.example` with the required local URI:
  `mongodb://localhost:27018/?replicaSet=rs0`.
- Added `.gitignore` entries for local environment files, dependencies, Next output, and Playwright output while preserving `.worktrees/`.
- Added `docker-compose.yml` using only `mongo:7`, with host `27018` mapped to container `27017`, `--replSet rs0`, and an isolated named volume.
- Added an idempotent replica-set initialization script. It first tries the required `mongo:27017` host and falls back to `127.0.0.1:27017` for the official image's temporary first-run server, which binds only to loopback during init.
- Documented local environment setup, `docker compose up -d`, replica-set readiness, the host/container port mapping, and safe volume cleanup guidance in `README.md`.
- Preserved and committed the prior worker's required `mongodb`/`zod` dependencies, lockfile, Vitest source-test discovery, and generated Next type declaration.

## RED / GREEN Evidence

The prior worker established the failing configuration-test step before implementation. The final focused green run was:

```text
npm test -- src/shared/config/environment.test.ts
Test Files  1 passed (1)
Tests  6 passed (6)
```

## Container Verification

The first `docker compose up -d` started only `authentication-foundation-mongo-1`. The initial readiness command exposed an image-entrypoint detail:

```text
MongoServerError: no replset config has been received
```

Container logs showed the init script ran while the temporary MongoDB was bound to `127.0.0.1`, so the `mongo:27017` attempt could not connect. The script was updated with the loopback fallback described above. Running the corrected script and readiness check produced:

```text
{ ok: 1 }
rs0
```

The required final sequence was then rerun successfully:

```text
npm test -- src/shared/config/environment.test.ts && docker compose up -d && docker compose exec mongo mongosh --quiet --eval 'rs.status().set'
Test Files  1 passed (1)
Tests  6 passed (6)
Container authentication-foundation-mongo-1 Running
rs0
```

The service uses `mongo:7` and publishes `0.0.0.0:27018->27017/tcp`. No unrelated containers were stopped, removed, or modified.

## Verification

Commands run after implementation and again after commit:

```text
npm test
Test Files  2 passed (2)
Tests  7 passed (7)

npm run typecheck
exit 0

npm run lint
exit 0

npm run build
exit 0

npx prettier --check README.md package.json package-lock.json vitest.config.ts src/shared/config/environment.ts src/shared/config/environment.test.ts src/shared/mongodb/client.ts docker-compose.yml
All matched files use Prettier code style!

sh -n docker/mongo-init.sh
exit 0

git diff HEAD^ HEAD --check
exit 0
```

The repository-wide `npm run format:check` remains non-zero because of pre-existing formatting warnings in 14 documentation/foundation files outside the Task 2-owned formatted set. Those unrelated files were not reformatted.

## Files Changed

- `.env.example`
- `.gitignore`
- `README.md`
- `docker-compose.yml`
- `docker/mongo-init.sh`
- `next-env.d.ts`
- `package-lock.json`
- `package.json`
- `src/shared/config/environment.test.ts`
- `src/shared/config/environment.ts`
- `src/shared/mongodb/client.ts`
- `vitest.config.ts`

## Commit

```text
fe1fed8 chore: add validated configuration and local Mongo replica set
```

## Self-review

- Confirmed the documented and example URI uses host port `27018` and replica set `rs0`.
- Confirmed Compose uses only `mongo:7` and maps `27018:27017`.
- Confirmed all environment values are validated through the single Zod schema.
- Confirmed `AppEnvironment` is frozen and Mongo client creation uses validated configuration.
- Confirmed no authentication, collections, repositories, or module-specific persistence behavior was introduced.
- Confirmed the worktree is clean after the commit.

## Fix Round 1: Host MongoDB Driver Connectivity

### Root Cause

The replica-set configuration advertises its sole member as `mongo:27017`, which is resolvable only within the Docker Compose network. A host-side Node.js MongoDB driver connects to the documented seed URI, receives that member address during discovery, then fails to resolve it:

```text
MongoServerSelectionError: getaddrinfo ENOTFOUND mongo
```

MongoDB rejects `localhost:27018` as the advertised member because, from inside the container, that address does not map to its internal `27017` listener. With the required single exposed endpoint and `27018:27017` mapping, the supported local-development configuration is a direct driver connection to the host seed. This avoids Docker-internal discovery while retaining transaction support from the `rs0` replica set.

### Regression Test and Result

Added `tests/integration/shared/mongodb-host-connection.test.ts`. It configures the documented host URI, obtains the real shared client, starts a transaction, performs an insert, and aborts it so the test leaves no record behind.

```text
npm test -- tests/integration/shared/mongodb-host-connection.test.ts
Test Files  1 passed (1)
Tests  1 passed (1)
Duration  456ms
```

### Covering Verification

```text
npm test -- src/shared/config/environment.test.ts
Test Files  1 passed (1)
Tests  6 passed (6)

npm test
Test Files  3 passed (3)
Tests  8 passed (8)

npm run typecheck
exit 0

npm run lint
exit 0

docker compose up -d
Container authentication-foundation-mongo-1 Running

docker compose exec mongo mongosh --quiet --eval 'rs.status().set'
rs0
```

No unrelated containers were stopped, removed, or modified.

### Commit

```text
3dbe372 fix: connect local Mongo client directly
```

## Fix Round 2: Scope Direct Connection to Local Docker Host URI

### Root Cause

Round 1 applied `directConnection: true` for every MongoDB URI. That preserves the documented local Docker host workflow, but it also disables normal replica-set member discovery for non-local deployments such as Atlas. The reviewer finding is correct: only the documented local host seed needs the direct-connection workaround.

### Regression Tests and Results

Added `src/shared/mongodb/client.test.ts` to prove the connection-option split:

- `mongodb://localhost:27018/?replicaSet=rs0` resolves to `{ directConnection: true }`
- a non-local `mongodb+srv://...` URI resolves to default client options `{}`, preserving normal discovery

Focused RED/GREEN evidence:

```text
npm test -- src/shared/mongodb/client.test.ts
Test Files  1 passed (1)
Tests  2 passed (2)

npm test -- tests/integration/shared/mongodb-host-connection.test.ts
Test Files  1 passed (1)
Tests  1 passed (1)
```

The integration regression still proves the documented localhost `27018` URI can start a transaction through the shared client.

### Covering Verification

```text
npm test
Test Files  4 passed (4)
Tests  10 passed (10)

npm run typecheck
exit 0

npm run lint
exit 0

npm run build
exit 0

docker compose up -d
Container authentication-foundation-mongo-1 Running

docker compose exec mongo mongosh --quiet --eval 'rs.status().set'
rs0
```

No unrelated containers were stopped, removed, or modified.

### Commit

```text
fix: scope local Mongo direct connection
```

# CrossVal Orders and Settlements

This repository contains the CrossVal Orders and Settlements take-home assignment.

## Local setup

Prerequisites: Node.js 20.9 or later, npm, and Docker Compose.

1. Copy the local configuration template: `cp .env.example .env.local`.
2. Start the transaction-capable local MongoDB instance: `docker compose up -d`. MongoDB listens on host port `27018` and container port `27017` because host port `27017` may already be in use.
3. Confirm the replica set is ready: `docker compose exec mongo mongosh --quiet --eval 'rs.status().set'`. It must print `rs0` before running code that uses MongoDB transactions.
4. Install dependencies with `npm install`, then start the application with `npm run dev`.

`.env.local` supplies the application database connection, database name, canonical origin, fixed seven-day session lifetime, bcrypt cost, and a bcrypt dummy hash for account-independent login verification. The provided local URI selects the Docker replica set; keep `SESSION_TTL_DAYS=7` and `BCRYPT_COST` at 12 or higher.

The local MongoDB client uses a direct connection because Docker exposes one replica-set endpoint (`localhost:27018`) while replica membership uses the internal Docker hostname. Transactions remain available through the single-node `rs0` replica set.

Stop the local database with `docker compose down`. Its named volume retains local data; use `docker compose down -v` only when intentionally discarding that data.

## Local authentication workflow

With MongoDB running and `npm run dev` serving the app on `http://localhost:3000`:

1. Open `http://localhost:3000/sign-up`.
2. Create a merchant account with a valid email and a password that is at least 12 characters long.
3. Confirm the browser redirects to `/dashboard`.
4. Use the `Log out` button in the protected app shell and confirm the browser redirects to `/login`.
5. Confirm the authenticated identity endpoint now rejects the cleared session cookie:
   `curl -i http://localhost:3000/api/v1/auth/me`

You can also verify login by signing back in at `http://localhost:3000/login` with the same credentials and confirming the redirect back to `/dashboard`.

Authentication cookies use one opaque `session` token with these attributes:

- `HttpOnly`
- `SameSite=Lax`
- `Path=/`
- explicit expiry aligned with `SESSION_TTL_DAYS`
- `Secure` only when `NODE_ENV=production`

The local auth API surface for this vertical slice is:

- `POST /api/v1/auth/sign-up` — creates the merchant-owned account and session cookie
- `POST /api/v1/auth/login` — authenticates existing credentials and refreshes the session cookie
- `POST /api/v1/auth/logout` — revokes the active session and clears the cookie
- `GET /api/v1/auth/me` — returns authenticated identity details or `401` when the session is absent, expired, or revoked

## Engineering documentation

- [Agent instructions](AGENTS.md)
- [Domain context](CONTEXT.md)
- Module designs: [Authentication](docs/superpowers/specs/2026-08-08-01-authentication-design.md), [Orders](docs/superpowers/specs/2026-08-08-02-orders-design.md), [Order Status](docs/superpowers/specs/2026-08-08-03-order-status-design.md), [Payments](docs/superpowers/specs/2026-08-08-04-payments-design.md), [Dashboard](docs/superpowers/specs/2026-08-08-05-dashboard-design.md), [REST API](docs/superpowers/specs/2026-08-08-06-rest-api-design.md), [Delivery and Quality](docs/superpowers/specs/2026-08-08-07-delivery-and-quality-design.md)
- [Architecture decisions](docs/adr/README.md)
- [Agent-development guidance](docs/agents/domain.md)

The completed README will document setup, API endpoints, status rules, assumptions, concurrency handling, deployed URL, and production improvements.

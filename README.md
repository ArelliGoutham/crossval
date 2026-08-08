# CrossVal Orders and Settlements

This repository contains the CrossVal Orders and Settlements take-home assignment.

## Local setup

Prerequisites: Node.js 20.9 or later, npm, and Docker Compose.

1. Copy the local configuration template: `cp .env.example .env.local`.
2. Start the transaction-capable local MongoDB instance: `docker compose up -d`. MongoDB listens on host port `27018` and container port `27017` because host port `27017` may already be in use.
3. Confirm the replica set is ready: `docker compose exec mongo mongosh --quiet --eval 'rs.status().set'`. It must print `rs0` before running code that uses MongoDB transactions.
4. Install dependencies with `npm install`, then start the application with `npm run dev`.

`.env.local` supplies the application database connection, database name, canonical origin, session lifetime, and bcrypt cost. The provided local URI selects the Docker replica set; keep `BCRYPT_COST` at 12 or higher.

The local MongoDB client uses a direct connection because Docker exposes one replica-set endpoint (`localhost:27018`) while replica membership uses the internal Docker hostname. Transactions remain available through the single-node `rs0` replica set.

Stop the local database with `docker compose down`. Its named volume retains local data; use `docker compose down -v` only when intentionally discarding that data.

## Engineering documentation

- [Agent instructions](AGENTS.md)
- [Domain context](CONTEXT.md)
- Module designs: [Authentication](docs/superpowers/specs/2026-08-08-01-authentication-design.md), [Orders](docs/superpowers/specs/2026-08-08-02-orders-design.md), [Order Status](docs/superpowers/specs/2026-08-08-03-order-status-design.md), [Payments](docs/superpowers/specs/2026-08-08-04-payments-design.md), [Dashboard](docs/superpowers/specs/2026-08-08-05-dashboard-design.md), [REST API](docs/superpowers/specs/2026-08-08-06-rest-api-design.md), [Delivery and Quality](docs/superpowers/specs/2026-08-08-07-delivery-and-quality-design.md)
- [Architecture decisions](docs/adr/README.md)
- [Agent-development guidance](docs/agents/domain.md)

The completed README will document setup, API endpoints, status rules, assumptions, concurrency handling, deployed URL, and production improvements.

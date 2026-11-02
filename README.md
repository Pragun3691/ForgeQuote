# ForgeQuote — RFQ-to-Quote Costing

An **individual** IsoCode Labs take-home project. Internal development target: **6 Nov 2026**; contingency feature-freeze: **8 Nov 2026**; external submission deadline: **9 Nov 2026, 23:59 IST**.

## Goal

Build one honest, working end-to-end RFQ → verified intake → deterministic costing at 2–3 volumes → approval gate → issued PDF quote, using versioned rates and auditable snapshots. Seed only **synthetic/anonymized** customer data.

## What this ZIP contains

T01 milestone 6 checkpoint: React/Express authentication, PostgreSQL rate history, pure decimal.js costing and immutable transactional quotation persistence through an internal service. Quotation HTTP/frontend integration awaits review. See `docs/current-status.md` and [Milestone 6 handoff](docs/quotation-persistence.md) for verification.

## Start (Windows PowerShell)

```powershell
npm.cmd ci
# Create ignored .env at repository root; see configuration below.
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run db:seed-users
npm.cmd test
npm.cmd run test:db
npm.cmd run build
# Terminal 1:
npm.cmd run dev:api
# Terminal 2:
npm.cmd run dev:web
```

Use Node 24 and PostgreSQL 17. Open http://127.0.0.1:5173 when using Vite; it proxies `/api` to Express (default port 3000). Use the exact host/port configured in APP_ORIGIN; an alternate localhost hostname or Vite fallback port will fail Origin validation. Stop conflicting servers rather than bypassing CSRF. For a same-origin built frontend run `npm.cmd run build`, set APP_ORIGIN to the actual origin (e.g. http://127.0.0.1:3000 locally), then `npm.cmd start`. Production NODE_ENV requires an HTTPS origin and secure cookies.

Root `.env` requires `DATABASE_URL`. Set `NODE_ENV=development`, `PORT=3000`, `DEMO_GST_PERCENT=18`; omit unused variables rather than leaving blank overrides. PostgreSQL URLs must contain correctly URL-encoded credentials when required by your server. Never commit `.env`. `pg` uses standard PostgreSQL URL TLS parameters; do not disable certificate verification for deployment. Local superuser connections are development-only, never deployment runtime credentials.

`.env.example` lists names only. Before starting the API, configure SESSION_SECRET (random, at least 32 bytes) and APP_ORIGIN (exact origin without trailing slash). Set distinct DEMO_ESTIMATOR_PASSWORD and DEMO_SALES_HEAD_PASSWORD (12+ characters, at most 256 UTF-8 bytes) before db:seed-users. Seed passwords are not needed by the running API. Current local auth values were generated into ignored .env; open that file locally to obtain your demo passwords, never commit or paste them into logs. TRUST_PROXY_HOPS defaults to 0; use 1 only with one trusted proxy and blocked direct access. Deployment is not complete; no hosting has been purchased.

## Database checkpoint setup

On this workspace, `forgequote_dev` and `forgequote_test` have already been created and root `.env` configured. On a fresh machine, create two empty databases with your PostgreSQL administrator (adjust username/host):

```powershell
psql -h localhost -U postgres -d postgres -c "CREATE DATABASE forgequote_dev"
psql -h localhost -U postgres -d postgres -c "CREATE DATABASE forgequote_test"
```

Set DATABASE_URL and TEST_DATABASE_URL in ignored .env to their respective PostgreSQL URLs. Test database name must end in _test. MIGRATION_DATABASE_URL is mandatory for migration and seed commands: use a different maintenance role targeting the same host, port and development database. There is no runtime-credential fallback. Omit maintenance credentials from the deployed API environment. Never point migration/seed commands at real customer data.

```powershell
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run db:seed-users
npm.cmd test
npm.cmd run test:db
npm.cmd run build
npm.cmd run dev:api
# In another terminal:
npm.cmd run dev:web
```

Migrations are atomic, checksummed and serialized; repeated execution is a no-op. Do not edit an applied migration: add a new one. db:seed inserts the synthetic spindle, six rate keys/versions and first route. db:seed-users separately inserts estimator and sales_head with salted hashes. Both reject drift instead of overwriting; the user seed never resets credentials or reactivates users. No quotation results are seeded.

Database tests create a generated schema inside the dedicated test database, then remove only that schema. They require schema-creation privileges. NUMERIC/BIGINT transport remains strings. `rate_periods` derives each exclusive end from the next start; no explicit expiry gaps are supported.

Local permissions: original development tables remain postgres-owned. Existing users/sessions were created under forgequote_app by commit 40f26fe; ownership is preserved per owner instruction. Ordinary runtime grants are SELECT-only on users/business/history/ledger and SELECT on rate_periods; sessions alone have SELECT/INSERT/UPDATE/DELETE. No TRUNCATE granted. The explicit maintenance file apps/api/db/runtime-grants.sql applies these table-specific grants without changing ownership. After reviewing the current schema, run it with your maintenance connection, then npm.cmd run db:check-permissions. Existing auth-table/database ownership still gives forgequote_app DDL powers and self-grant capability; removing these requires a separate, explicitly approved ownership/provisioning decision before public deployment. Test-generated schemas are isolated and owned by the test role.

GET /api/health/ready requires PostgreSQL and migration 002; it is an authentication readiness check, not verification of the later quote schema. Auth endpoints: GET /api/auth/session, POST /api/auth/login, POST /api/auth/logout. No draft-creation endpoint exists; it returns 404. Authentication/role/CSRF middleware is tested on a test-only probe. Milestone 6 separately tests real internal quotation writes with database actor authorization and restricted runtime privileges. No RFQ read or quotation HTTP API exists.

## Test login locally

Run the API and Vite commands above. Select Estimator or Sales head, use its password from ignored .env, sign in, reload, and sign out. All actions use the real API and PostgreSQL sessions. An incorrect password gives a generic error. Ten login requests per IP in 15 minutes trigger 429, including successful requests. Restarting the single API instance clears its process-local throttle; sessions remain in PostgreSQL.

Automated local browser verification uses installed Chrome by default, starts an ephemeral same-origin API serving the built frontend, and reads the local seed credentials without printing them:

```powershell
npm.cmd run build
npm.cmd run test:browser
# If only Edge is installed:
$env:BROWSER_CHANNEL = 'msedge'
npm.cmd run test:browser
```

Browser smoke requires local PostgreSQL, migration/seeded users and the built frontend. Unit/API tests use generated secrets; integration tests use generated isolated schemas in the _test database. Production cookie checks simulate HTTPS through a trusted proxy; they do not claim a deployed TLS service.

## Deterministic costing checkpoint

Milestone 5 adds a pure decimal.js engine, independent of HTTP, database and UI. Run `npm.cmd run test:costing` for the nine approved golden cases and financial boundaries. See [costing-engine.md](docs/costing-engine.md) for the public input/output contract and examples. Milestone 6 adds six quotation tables in migration 003 and an internal creation/retrieval service using that engine. Approved v0.2 values remain unchanged. See [quotation-persistence.md](docs/quotation-persistence.md) and [ADR-0005](docs/decisions/0005-quotation-snapshots.md) for schema, API, concurrency, historical evidence and limitations. Stop before Milestone 7; quotation HTTP/frontend integration is not implemented.

After migration 003, apply `apps/api/db/runtime-grants.sql` explicitly with maintenance credentials and run `npm.cmd run db:check-permissions`. Do not run migrations as runtime or change ownership of existing tables. Quote integration tests additionally require maintenance credentials with CREATE ROLE/SCHEMA capability on the configured dedicated test database; generated test roles/schemas are cleaned up. Keep MIGRATION_DATABASE_URL out of deployed runtime settings.

## Definition of complete

See `docs/requirements.md` and `tasks/T01-thin-slice.md`. This repo should progress through small reviewable commits, tests, and real deployed slices. Keep a working build throughout.

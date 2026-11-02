# ForgeQuote — RFQ-to-Quote Costing

An **individual** IsoCode Labs take-home project. Internal development target: **6 Nov 2026**; contingency feature-freeze: **8 Nov 2026**; external submission deadline: **9 Nov 2026, 23:59 IST**.

## Goal

Build one honest, working end-to-end RFQ → verified intake → deterministic costing at 2–3 volumes → approval gate → issued PDF quote, using versioned rates and auditable snapshots. Seed only **synthetic/anonymized** customer data.

## What this ZIP contains

T01 milestone 7 checkpoint: sign in, open a stored RFQ, edit costing inputs, save through the authenticated/idempotent API and inspect saved three-tier quotations with historical rate provenance. Refresh and backend restart preserve the saved version. See [Milestone 7 handoff](docs/milestone-7-handoff.md) for actual tests, API contracts, commands, screenshots and limits. STOP before Milestone 8 or deployment.

## Start (Windows PowerShell)

```powershell
npm.cmd ci
# Create ignored .env at repository root; see configuration below.
npm.cmd run db:migrate
npm.cmd run db:grant-runtime
npm.cmd run db:check-permissions
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

Database tests create generated schemas inside the dedicated test database and remove only their fixtures. Quote/HTTP/browser tests additionally use maintenance CREATE ROLE/SCHEMA capability to test a generated non-owner runtime role; those roles are cleaned up. NUMERIC/BIGINT transport remains strings. `rate_periods` derives each exclusive end from the next start; no explicit expiry gaps are supported.

Local permissions: original development tables remain postgres-owned. Existing users/sessions were created under forgequote_app by commit 40f26fe; ownership is preserved per owner instruction. Ordinary runtime grants are SELECT-only on master data/users/ledger, sessions CRUD, snapshot SELECT/INSERT and column-specific header counter UPDATE. New draft_submissions has SELECT/column INSERT only. No history UPDATE/DELETE or TRUNCATE. The explicit maintenance command npm.cmd run db:grant-runtime applies apps/api/db/runtime-grants.sql without ownership changes, then npm.cmd run db:check-permissions verifies access. Existing auth-table/database ownership still gives forgequote_app DDL/self-grant powers and blocks public runtime isolation. Generated quote/HTTP test schemas are maintenance-owned; test runtime roles are non-owners.

GET /api/health/ready requires PostgreSQL and migration 004. Auth endpoints: GET /api/auth/session, POST /api/auth/login, POST /api/auth/logout. Protected business endpoints: GET /api/rfqs, GET /api/rfqs/:id, POST /api/rfqs/:id/quote-versions and GET /api/quote-versions/:id. POST requires estimator role, Origin, X-CSRF-Token and a UUID Idempotency-Key. Sales head can read only. See the handoff for strict request/response/error contracts. The UI and server preserve exact decimal-string financial values.

## Test login locally

Run the API and Vite commands above. Select Estimator, use its password from ignored .env, sign in and open RFQ-2611-014. Select pricing date 2026-11-02, margin 20 and quantities 90000/180000/270000; calculate/save. The saved baseline cost is 119.76 and price is 149.70. Refresh to retrieve the same saved version. Sales head can inspect it but cannot create. Start new calculation is an explicit new version/key; after uncertain failure, retry the same pending submission. The tab retains pending key/body across refresh/expiry in sessionStorage. No authoritative client pricing or fake business values.

An incorrect password gives a generic error. Ten login requests per IP in 15 minutes trigger 429, including successful requests. Restarting the single API instance clears its process-local throttle; sessions remain in PostgreSQL.

Automated local browser verification uses installed Chrome by default, starts an ephemeral same-origin API serving the built frontend, and reads the local seed credentials without printing them:

```powershell
npm.cmd run build
npm.cmd run test:browser
npm.cmd run test:browser:quotation
# If only Edge is installed:
$env:BROWSER_CHANNEL = 'msedge'
npm.cmd run test:browser
```

The legacy auth smoke requires local development PostgreSQL/migrations/seeded users and built frontend. The quotation smoke creates an isolated test schema/non-owner role and random users, starts a real child API process, restarts it, and tests committed-response loss plus refresh/same-key recovery. It writes ignored desktop/mobile screenshots under .tmp. Both use installed Chrome (or BROWSER_CHANNEL=msedge). Unit/API tests use generated secrets; integration tests use the dedicated _test database. Production cookie checks simulate HTTPS through a trusted proxy; they do not claim a deployed TLS service.

## Deterministic costing checkpoint

Milestone 5 adds a pure decimal.js engine, independent of HTTP, database and UI. Run `npm.cmd run test:costing` for the nine approved golden cases and financial boundaries. See [costing-engine.md](docs/costing-engine.md) for its input/output contract. Milestone 6 adds six snapshot tables and an internal service; Milestone 7 wraps it in authenticated HTTP and React with transactional submission-key receipts. Approved v0.2 formulas/goldens and migrations 001-003 remain unchanged. See [Milestone 7 handoff](docs/milestone-7-handoff.md), [ADR-0005](docs/decisions/0005-quotation-snapshots.md) and [ADR-0006](docs/decisions/0006-http-submission-idempotency.md).

After migration 004, run npm.cmd run db:grant-runtime explicitly with maintenance credentials and npm.cmd run db:check-permissions. Do not migrate as runtime or change existing ownership. Keep MIGRATION_DATABASE_URL out of deployed runtime settings. No deployment is authorized in this milestone.

## Definition of complete

See `docs/requirements.md` and `tasks/T01-thin-slice.md`. This repo should progress through small reviewable commits, tests, and real deployed slices. Keep a working build throughout.

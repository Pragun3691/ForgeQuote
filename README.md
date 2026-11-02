# ForgeQuote — RFQ-to-Quote Costing

An **individual** IsoCode Labs take-home project. Internal development target: **6 Nov 2026**; contingency feature-freeze: **8 Nov 2026**; external submission deadline: **9 Nov 2026, 23:59 IST**.

## Goal

Build one honest, working end-to-end RFQ → verified intake → deterministic costing at 2–3 volumes → approval gate → issued PDF quote, using versioned rates and auditable snapshots. Seed only **synthetic/anonymized** customer data.

## What this ZIP contains

Current checkpoint: T02.1 manual RFQ intake. Estimators create 1-20 reviewed parts using real internal rate keys; atomic saves and retained submission keys recover uncertain outcomes without retry duplicates. Open New RFQ from the register. Multiple-part intake/read works; existing quotation HTTP/UI still costs one part only. No Gemini/Excel/PDF intake or AI verification yet. See [T02.1 handoff and exact file manifest](docs/t02-1-handoff.md) and [ADR-0008](docs/decisions/0008-manual-rfq-intake.md). STOP for owner approval before T02.2. No deployment or purchase.

Previous T01 milestone 8 preparation: strict TLS, fresh-database role isolation, liveness, redacted logs and write throttling. No cloud accounts/resources/purchases/deployment yet. Local database ownership remains unchanged. See [Milestone 8 handoff](docs/milestone-8-handoff.md) and [deployment procedure](docs/deployment.md). Quotation/API/browser contracts remain documented in the [Milestone 7 handoff](docs/milestone-7-handoff.md).

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

Local permissions: original development tables remain postgres-owned. Existing users/sessions ownership is preserved per owner instruction. Grants include master/user/ledger SELECT, session CRUD, snapshot INSERT and column-specific quotation counter UPDATE. T02.1 adds column INSERT for RFQs/parts/routes/receipts and receipt SELECT. No history/input UPDATE/DELETE or TRUNCATE. Apply 005 using npm.cmd run db:migrate before npm.cmd run db:grant-runtime, then npm.cmd run db:check-permissions. Existing auth-table/database ownership still permits owner DDL/self-grants and blocks public runtime isolation. Generated test fixtures use maintenance-owned tables and restricted runtime roles. T02.1 applied 005 only to disposable test fixtures, not existing development schemas.

GET /api/health/live is DB/session-free. GET /api/health/ready requires PostgreSQL and migration 005. Auth: GET /api/auth/session, POST /api/auth/login, POST /api/auth/logout. Protected business endpoints: GET /api/rfqs, GET /api/rfqs/:id, GET /api/rfq-rate-keys, POST /api/rfqs, POST /api/rfqs/:id/quote-versions and GET /api/quote-versions/:id. Business POST requires estimator role, Origin, X-CSRF-Token and UUID Idempotency-Key. RFQ and quote creation each have separate process-local 30-attempt/estimator/15-minute limits. Sales head reads only. On 429 retain key/body and retry later. RFQ POST allows 64 KiB; other JSON retains 4 KiB. All financial values stay decimal strings.

## Test login locally

Run the API and Vite commands above. Select Estimator, use its password from ignored .env, sign in and open RFQ-2611-014. Select pricing date 2026-11-02, margin 20 and quantities 90000/180000/270000; calculate/save. The saved baseline cost is 119.76 and price is 149.70. Refresh to retrieve the same saved version. Sales head can inspect it but cannot create. Start new calculation is an explicit new version/key; after uncertain failure, retry the same pending submission. The tab retains pending key/body across refresh/expiry in sessionStorage. No authoritative client pricing or fake business values.

An incorrect password gives a generic error. Ten login requests per IP in 15 minutes trigger 429, including successful requests. Restarting the single API instance clears its process-local throttle; sessions remain in PostgreSQL.

Automated local browser verification uses installed Chrome by default and starts an ephemeral same-origin API serving the built frontend. Each suite creates a new disposable local database with generated users and a restricted runtime role; neither uses development users or writes sessions to an existing database:

```powershell
npm.cmd run build
npm.cmd run test:browser
npm.cmd run test:browser:quotation
npm.cmd run test:browser:rfq
# If only Edge is installed:
$env:BROWSER_CHANNEL = 'msedge'
npm.cmd run test:browser
```

All three browser suites require the built frontend, local TEST_DATABASE_URL ending in _test and same-host maintenance credentials able to create disposable databases/roles. They migrate/seed only generated databases and remove fixtures afterward. Quotation smoke tests real API process restart and committed-response loss; manual intake smoke tests multi-part correction/save, committed-response loss, exact key/body recovery and unchanged single-part costing. Screenshots go under ignored .tmp. Use Chrome or BROWSER_CHANNEL=msedge. Other integration tests use isolated dedicated _test fixtures. Production cookie checks simulate HTTPS through a trusted proxy; no deployed TLS claim.

## Deterministic costing checkpoint

Milestone 5 adds a pure decimal.js engine, independent of HTTP, database and UI. Run `npm.cmd run test:costing` for the nine approved golden cases and financial boundaries. See [costing-engine.md](docs/costing-engine.md) for its input/output contract. Milestone 6 adds six snapshot tables and an internal service; Milestone 7 wraps it in authenticated HTTP and React with transactional submission-key receipts. Approved v0.2 formulas/goldens and migrations 001-003 remain unchanged. See [Milestone 7 handoff](docs/milestone-7-handoff.md), [ADR-0005](docs/decisions/0005-quotation-snapshots.md) and [ADR-0006](docs/decisions/0006-http-submission-idempotency.md).

After migration 004, run npm.cmd run db:grant-runtime explicitly with maintenance credentials and npm.cmd run db:check-permissions. Do not migrate as runtime or change existing ownership. Keep MIGRATION_DATABASE_URL out of deployed runtime settings. No deployment is authorized in this milestone.

## Milestone 8 preparation checks

Node is pinned to the tested 24.20.0. Production requires certificate/hostname-verified PostgreSQL TLS; local development remains unchanged. Production skips .env auto-loading and rejects maintenance/test/seed credentials in its application environment. New configuration names are DATABASE_TLS_MODE, optional DATABASE_CA_CERT and maintenance-only CLOUD_DATABASE_NAME. Values/secrets must never be committed.

```powershell
npm.cmd test
npm.cmd run test:db
npm.cmd run check:api
npm.cmd run build
npm.cmd run test:production
npm.cmd run test:browser
npm.cmd run test:browser:quotation
```

TLS tests require OpenSSL on PATH and generate/delete ephemeral keys under ignored .tmp. Fresh-cloud tests additionally require the local maintenance/test bootstrap to create disposable databases and roles; they never transfer ownership of existing databases. The generated database is migrated/seeded and accessed through real restricted LOGIN credentials, then removed. Before/after checks preserve local ownership/public ACLs. Existing cost formulas, migrations 001-004 and goldens are unchanged.

For a future approved fresh Neon database only: db:prepare-cloud and db:check-cloud-permissions are separate maintenance/preflight commands. They require explicit CLOUD_DATABASE_NAME and refuse preserved local targets. Do not run them as local ownership repair. See [deployment.md](docs/deployment.md) for SQL role creation, exact environment separation, Render settings and manual release gates. No account access or cloud setup occurred in this milestone.

## Definition of complete

See `docs/requirements.md` and `tasks/T01-thin-slice.md`. This repo should progress through small reviewable commits, tests, and real deployed slices. Keep a working build throughout.

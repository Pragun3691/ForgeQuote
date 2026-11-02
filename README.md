# ForgeQuote — RFQ-to-Quote Costing

An **individual** IsoCode Labs take-home project. Internal development target: **6 Nov 2026**; contingency feature-freeze: **8 Nov 2026**; external submission deadline: **9 Nov 2026, 23:59 IST**.

## Goal

Build one honest, working end-to-end RFQ → verified intake → deterministic costing at 2–3 volumes → approval gate → issued PDF quote, using versioned rates and auditable snapshots. Seed only **synthetic/anonymized** customer data.

## What this ZIP contains

T01 milestone 4 checkpoint: React/Express, PostgreSQL history and real demo authentication. Costing and quotation persistence are not implemented yet. See `docs/current-status.md` for verification.

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

Set `DATABASE_URL` and `TEST_DATABASE_URL` in ignored `.env` to their respective PostgreSQL URLs. Test database name must end in `_test`. If using separate migration credentials, set `MIGRATION_DATABASE_URL` to the development database using that maintenance account. Never point migration/seed commands at real customer data.

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

Local permission note: changing database ownership does not transfer existing tables. This workspace's postgres-owned development tables grant forgequote_app SELECT/INSERT, plus SELECT on rate_periods; UPDATE/DELETE are not granted. Future migrations altering these existing objects require owner-level maintenance credentials through MIGRATION_DATABASE_URL. Do not solve this by making the runtime role a superuser or disabling history triggers. Test-generated schemas are owned by the configured test role and do not modify development tables.

`GET /api/health/ready` requires PostgreSQL and migration 002. Auth endpoints: GET /api/auth/session, POST /api/auth/login, POST /api/auth/logout. The draft POST /api/rfqs/:id/quote-versions enforces auth/role/CSRF, then returns explicit 501 for an estimator because persistence is not implemented. No RFQ read API or costing engine exists yet.

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

## Definition of complete

See `docs/requirements.md` and `tasks/T01-thin-slice.md`. This repo should progress through small reviewable commits, tests, and real deployed slices. Keep a working build throughout.

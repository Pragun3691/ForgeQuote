# ForgeQuote — RFQ-to-Quote Costing

An **individual** IsoCode Labs take-home project. Internal development target: **6 Nov 2026**; contingency feature-freeze: **8 Nov 2026**; external submission deadline: **9 Nov 2026, 23:59 IST**.

## Goal

Build one honest, working end-to-end RFQ → verified intake → deterministic costing at 2–3 volumes → approval gate → issued PDF quote, using versioned rates and auditable snapshots. Seed only **synthetic/anonymized** customer data.

## What this ZIP contains

T01 foundation checkpoint: React/Express workspace and PostgreSQL configuration. Authentication and costing are not implemented yet. See `docs/current-status.md` for actual verification.

## Start (Windows PowerShell)

```powershell
npm.cmd ci
# Create ignored .env at repository root; see configuration below.
npm.cmd test
npm.cmd run build
# Terminal 1:
npm.cmd run dev:api
# Terminal 2:
npm.cmd run dev:web
```

Use Node 24 and PostgreSQL 17. Vite prints its local URL (normally http://127.0.0.1:5173) and proxies `/api` to Express (default port 3000). For a same-origin production build run `npm.cmd run build`, then `npm.cmd start`; Express serves `apps/web/dist`. No write endpoints are enabled.

Root `.env` requires `DATABASE_URL`. Set `NODE_ENV=development`, `PORT=3000`, `DEMO_GST_PERCENT=18`; omit unused variables rather than leaving blank overrides. PostgreSQL URLs must contain correctly URL-encoded credentials when required by your server. Never commit `.env`. `pg` uses standard PostgreSQL URL TLS parameters; do not disable certificate verification for deployment. Local superuser connections are development-only, never deployment runtime credentials.

`.env.example` lists variable names only. Session and demo-password variables are reserved for milestone 4 and are not used yet. Deployment is not complete; no hosting has been purchased.

## Definition of complete

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
npm.cmd test
npm.cmd run test:db
npm.cmd run build
npm.cmd run dev:api
# In another terminal:
npm.cmd run dev:web
```

Migrations are atomic, checksummed and serialized; repeated execution is a no-op. Do not edit an applied migration: add a new one. Seed commands insert only the synthetic spindle, six rate keys/versions and its first route. They reject fixture drift instead of overwriting. No demo users or quotations are seeded yet.

Database tests create a generated schema inside the dedicated test database, then remove only that schema. They require schema-creation privileges. NUMERIC/BIGINT transport remains strings. `rate_periods` derives each exclusive end from the next start; no explicit expiry gaps are supported.

Local permission note: changing database ownership does not transfer existing tables. This workspace's postgres-owned development tables grant forgequote_app SELECT/INSERT, plus SELECT on rate_periods; UPDATE/DELETE are not granted. Future migrations altering these existing objects require owner-level maintenance credentials through MIGRATION_DATABASE_URL. Do not solve this by making the runtime role a superuser or disabling history triggers. Test-generated schemas are owned by the configured test role and do not modify development tables.

`GET /api/health/ready` returns 200 only when PostgreSQL and migration 001 are available, otherwise 503. No RFQ/costing/auth endpoints exist yet. The root page is an honest workspace status screen, not the final application.

See `docs/requirements.md` and `tasks/T01-thin-slice.md`. This repo should progress through small reviewable commits, tests, and real deployed slices. Keep a working build throughout.

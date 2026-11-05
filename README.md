# ForgeQuote — RFQ-to-Quote Costing

An **individual** IsoCode Labs take-home project. Internal development target: **6 Nov 2026**; contingency feature-freeze: **8 Nov 2026**; external submission deadline: **9 Nov 2026, 23:59 IST**.

## Goal

Build one honest, working end-to-end RFQ → verified intake → deterministic costing at 2–3 volumes → approval gate → issued PDF quote, using versioned rates and auditable snapshots. Seed only **synthetic/anonymized** customer data.

## What this ZIP contains

Current checkpoint: T03 supports complete 1-20-part draft quotations, unchanged deterministic three-scenario costing/GST, immutable snapshots and idempotent recovery. Intake supports reviewed manual entry, pasted-text Gemini suggestions with literal evidence checks, and bounded template-based Excel import. [T03 handoff](docs/t03-handoff.md) records the verified scope and unchanged nine goldens. Approval, issuance, customer quotation PDF and RFQ PDF intake remain pending.

Estimators confirm every imported/proposed part, fill missing manufacturing facts and choose internal rate keys before saving. Real local Gemini SDK/Chrome extraction was verified in the [association handoff](docs/t02-part-association-handoff.md); current production Gemini connectivity/billing/data handling is unverified. Automated normal suites mock the provider. Manual/Excel entry remains available without an AI key.

T07 updates Render to main, Node 24.20.0 and the existing one-origin Express/React architecture. Neon provisioning is complete with maintenance-owned objects and a separate restricted runtime role; local databases are preserved. No public Render deployment is claimed. Exact dashboard/environment settings, private maintenance boundaries and outstanding live checks are in [deployment instructions](docs/deployment.md). This checkpoint does not push, merge or deploy.

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

T02.2 additionally exposes estimator-only GET/POST /api/rfq-extraction. POST requires Origin/CSRF and explicit source consent/synthetic attestation, permits 64 KiB JSON with 12000 source characters, and performs no database write. Five attempts/estimator/15 minutes and two in-flight calls per process are separate from manual saves. Errors retain manual entry; availability status indicates configuration only.

## Optional Gemini local setup and review

Keep the provider key exclusively in ignored root .env as AI_API_KEY. Obtain/use an unpaid project key locally; never put a key in React, a VITE_ variable, Git or chat. No billing activation is required or authorized. Optional nonsecret settings: AI_MODEL=gemini-3.5-flash-lite and AI_TIMEOUT_MS=20000 (1000-30000 allowed). Restart the API after changes. Missing/invalid AI configuration leaves manual RFQ entry available. The API uses pinned @google/genai 2.32.0 and Zod 4.6.7; it does not implicitly read SDK key aliases or fall back to another model.

In New RFQ expand Extract from text with AI (optional). Paste only synthetic nonconfidential text, read the linked provider disclosure, confirm both checkboxes and extract. Inspect raw/normalized suggestions, source quotes/locations and the four verification labels. Use verified suggestions explicitly replaces form fields/parts; rejected fields and all internal rate keys remain empty. Correct/fill facts, choose real keys and confirm review before the existing save. Continue manually collapses the panel; provider failure never creates a fake suggestion or RFQ.

Automatic mapping conservatively requires labeled lines and explicit Part:/Part number:/Item: sections. It checks complete values/tokens, correct part, supported units, exact decimal conversion and known contradictions. Generic prose or ambiguous dates/units may require manual correction; setup requires explicit per-batch wording. The full pasted source/evidence are transient; reviewed facts use existing RFQ/recovery storage. [Detailed verifier rules and limits](docs/decisions/0009-gemini-extraction.md).

After privately configuring an unpaid key, npm.cmd run test:ai:live makes a genuine call using the tracked synthetic fixture and prints only success/failure metadata. Without a key it prints LIVE PROVIDER TEST NOT RUN. Regular test suites always mock provider calls. No actual provider call occurred in this checkpoint.

## Test login locally

Run the API and Vite commands above. Select Estimator, use its password from ignored .env, sign in and open RFQ-2611-014. Select pricing date 2026-11-02, margin 20 and quantities 90000/180000/270000; calculate/save. The saved baseline cost is 119.76 and price is 149.70. Refresh to retrieve the same saved version. Sales head can inspect it but cannot create. Start new calculation is an explicit new version/key; after uncertain failure, retry the same pending submission. The tab retains pending key/body across refresh/expiry in sessionStorage. No authoritative client pricing or fake business values.

An incorrect password gives a generic error. Ten login requests per IP in 15 minutes trigger 429, including successful requests. Restarting the single API instance clears its process-local throttle; sessions remain in PostgreSQL.

Automated local browser verification uses installed Chrome by default and starts an ephemeral same-origin API serving the built frontend. Each suite creates a new disposable local database with generated users and a restricted runtime role; neither uses development users or writes sessions to an existing database:

```powershell
npm.cmd run build
npm.cmd run test:browser
npm.cmd run test:browser:quotation
npm.cmd run test:browser:rfq
npm.cmd run test:browser:ai
# If only Edge is installed:
$env:BROWSER_CHANNEL = 'msedge'
npm.cmd run test:browser
```

All four browser suites require the built frontend, local TEST_DATABASE_URL ending in _test and same-host maintenance credentials able to create disposable databases/roles. They migrate/seed only generated databases and remove fixtures afterward. Quotation smoke tests real API process restart/committed-response loss; manual intake tests correction/save and exact-key recovery. AI smoke tests consent, four verification labels, normalization, human correction, confirmed save and quota/manual fallback with an explicitly mocked provider. Screenshots go under ignored .tmp. Use Chrome or BROWSER_CHANNEL=msedge. Other integration tests use isolated dedicated _test fixtures. Production cookie checks simulate HTTPS through a trusted proxy; no deployed TLS claim.

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

## Excel RFQ intake (T02.3)

In New RFQ, open Import Excel part list and download the synthetic example. Use the documented headers and plain General-format .xlsx cells, attest synthetic data, inspect worksheet/cell evidence, deliberately copy parts, fill gaps/select internal rate keys and confirm before saving. Excel never calls Gemini or saves automatically. Limits, precise supported template, numeric handling, security and known gaps: [T02.3 handoff](docs/t02-3-handoff.md). No migrations or deployment changes.

Run `npm.cmd test`, `npm.cmd run test:db` and `npm.cmd run test:browser:xlsx`. The new browser/API import fixtures create and clean up disposable local databases, preserving existing development data. PDF intake is not implemented; customer quotation PDF generation is described below.


T04 adds version-specific approval and issuance (local verification complete; separate cloud migration/release required). Estimator submits a saved current version; values at/below INR 25,00,000 excluding GST clear automatically, higher values require Sales Head approval. Sales Head uses Pending approvals to inspect the exact immutable snapshot and approve/reject with a reason. Estimator then issues the eligible version; its stable number is saved in append-only history. New versions need their own clearance. Refresh lifecycle to observe another session's decisions; retry the same lifecycle action after an uncertain response. T05 adds the issued customer PDF download described below.

For the synthetic automatic-clearance demo, open RFQ-2611-014, use pricing date 2026-11-02, margin 20 and quantities 500/1000/1500 (50/100/150%). Save, then Submit for clearance and Issue quotation. The independently checked baseline excluding GST is INR 3,01,850.00. Start new calculation first if a saved submission is already present. This fixture is also created in the disposable T04 PostgreSQL/Chrome tests; no existing/cloud demo data was modified. Run npm run test:browser:lifecycle with the same local disposable database setup as other browser suites. Contracts/endpoints/migration implications: docs/t04-handoff.md and ADR-0014.


T05 customer quotation PDF: after issuance, use Download customer PDF in the selected version's lifecycle panel. Both active demo roles can download the current issued version through GET /api/quote-versions/:id/pdf. The A4 attachment uses the saved customer/RFQ, exact issued number/date/version, all three quantity scenarios and saved selling/GST totals. Internal manufacturing costs, rates and margins are excluded. Unissued/rejected/superseded final downloads are denied; no draft preview is provided. PDF generation uses bundled licensed fonts and pure Node libraries, with no new environment variables or migration. Run npm run test:browser:pdf for the disposable local browser check. Contract, font coverage, limits and results: docs/t05-handoff.md and ADR-0015.


T06 adds View rate catalogue for both demo roles: inspect all six rate categories, an as-of date and full effective-dated history with units/version IDs. The final-requirements continuation adds Sales Head version authoring on existing keys, with decimal-string validation, a reason, a forward-only Asia/Kolkata start date and exact-request recovery. Estimators retain read access; history cannot be overwritten or deleted. Migration 007 and reviewed narrow column grants are required before release.

RFQ intake now has compact extracted/imported summaries, collapsible source evidence, missing-field lists and keyboard component navigation. Single-available-key suggestions stay unselected until Use suggested keys is pressed. Apply common rate keys to all parts copies part 1's six selected IDs with explicit overwrite wording. All changes clear final estimator review. Rate history opens in a new tab during editing; unsubmitted fields remain in the original form. Existing exact retry bodies/keys and backend validation remain unchanged. Run npm run test:browser:rates-ux for the focused disposable Chrome check; contracts/results/remaining policy: docs/t06-handoff.md and ADR-0016.

Final requirements also add derived RFQ estimating/sent/won/lost status, assigned estimator and Sales Head terminal outcomes with immutable actor/reason history. Download INTERNAL costing PDF in any saved version for confidential saved costs/rates/margins, including historical versions. The customer PDF path retains its current-issued-only eligibility and confidential-field exclusions. Run `npm run test:browser:final`; see [final requirements handoff](docs/final-requirements-handoff.md) and [ADR-0017](docs/decisions/0017-final-requirements.md). This branch is local only; no deployment is performed.

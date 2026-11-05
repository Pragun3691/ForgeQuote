# Render + Neon deployment

T07 uses one Render Node web service to serve Express and the built React frontend on the same HTTPS origin. Neon provisioning is complete for project forgequote-demo, branch production, database neondb, Singapore. No public Render deployment is claimed. The latest owner instruction permits local configuration/docs/tests/commit only: do not reconnect to either cloud dashboard/database, push, merge or deploy in this checkpoint.

## Render settings

| Setting | Exact configuration |
| --- | --- |
| Service | Web Service, Node runtime, Free plan |
| Repository root | Repository root (leave Root Directory empty) |
| Branch | main; the reviewed deployment commit must first be made available there by the owner |
| Node | 24.20.0, matching .node-version and NODE_VERSION |
| Region | Singapore |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health/live` |
| Auto-deploy | Off (`autoDeployTrigger: "off"`) |
| Port/bind | Render supplies PORT; Express binds 0.0.0.0 at that port |
| Migration/seed hook | None; maintenance remains separate from application startup |

Express serves apps/web/dist and /api together. Production refuses a missing frontend build. Do not configure a separate static site, permissive CORS, frontend database connection, worker or persistent disk. Initial service creation may deploy even with auto-deploy off; it remains a separate owner action.

## Render environment

| Name | Value/source |
| --- | --- |
| NODE_ENV | production |
| NODE_VERSION | 24.20.0 |
| DATABASE_URL | Private direct Neon URL for restricted forgequote_app, database neondb; never neondb_owner |
| DATABASE_TLS_MODE | verify-full |
| DATABASE_CA_CERT | Optional trusted PEM CA only when necessary; ordinarily omit |
| APP_ORIGIN | Exact actual HTTPS Render origin, without trailing slash/path; obtain it from the dashboard, never invent it |
| SESSION_SECRET | Stable private random secret, at least 32 bytes; Blueprint generates one |
| TRUST_PROXY_HOPS | 1 for Render's single trusted HTTPS proxy; direct app access must not bypass that proxy |
| DEMO_GST_PERCENT | 18, explicitly illustrative |
| AI_API_KEY | Private server-side Gemini key; omit to retain manual/Excel intake with AI visibly unavailable |
| AI_MODEL | gemini-3.5-flash-lite (existing approved model) |
| AI_TIMEOUT_MS | 20000 |
| PORT | Supplied by Render; do not hardcode a local port |

AI_MODEL and AI_TIMEOUT_MS have code defaults and are pinned in render.yaml. Supply AI_API_KEY separately in private service environment settings when enabling Gemini. No VITE_* variable should contain an API key, database URL or session secret. React calls relative /api endpoints only.

Never include MIGRATION_DATABASE_URL, TEST_DATABASE_URL, DEMO_ESTIMATOR_PASSWORD or DEMO_SALES_HEAD_PASSWORD in Render: production startup rejects maintenance/test/seed secrets. CLOUD_DATABASE_NAME and CLOUD_DATABASE_HOST are maintenance-tool settings, not runtime requirements. Do not set NODE_TLS_REJECT_UNAUTHORIZED=0 or disable certificate checks. Runtime has no owner-role fallback.

## Neon state and maintenance boundaries

Previously verified over certificate-validated direct TLS: current database neondb; actual/session/owner identity neondb_owner; zero application objects before provisioning. A separate SQL-created forgequote_app LOGIN was created with NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS and no role memberships. Existing owners were not transferred.

Existing preparation tooling applied unchanged migrations 001-005 and explicit grants, then seeded synthetic spindle/rates and estimator/sales_head identities. The actual strict runtime checker passed: 16 tables, four functions, expected 27 enabled triggers, view/domain privileges, exact column grants and no runtime-owned objects. Migration 005 was confirmed in the ledger. No local database was migrated/regranted/reset.

Do not rerun CREATE ROLE, reset existing passwords or repeat bootstrap just because this checkout was resumed. Maintenance-owned users remains runtime SELECT-only; the preserved local users UPDATE(id) compatibility exception does not apply to cloud ownership.

For a later separately authorized maintenance session, the existing PowerShell-compatible commands are:

```powershell
# Supply DATABASE_URL (runtime) and MIGRATION_DATABASE_URL (maintenance)
# privately in that shell, targeting the same confirmed direct Neon endpoint.
# Never echo their values or put them in scripts, Git, screenshots or shared logs.
$env:NODE_ENV = 'production'
$env:DATABASE_TLS_MODE = 'verify-full'
$env:CLOUD_DATABASE_NAME = 'neondb'
# CLOUD_DATABASE_HOST must be the exact independently confirmed direct hostname.
# The neondb CLI guard rejects absent/mismatched, local and pooled hostnames.
npm.cmd run db:check-cloud-permissions
# Only when maintenance is actually needed and separately authorized:
npm.cmd run db:prepare-cloud
# prepare-cloud runs checksummed migrations plus reviewed grants; no owner transfer.
npm.cmd run db:seed
# Supply existing private demo passwords before verifying/repeating user seeds:
npm.cmd run db:seed-users
npm.cmd run db:check-cloud-permissions
```

The target-name allowance for neondb does not relax ownership, role, TLS, inventory or ACL checks. Existing dedicated forgequote_* test targets remain supported; forgequote_dev, forgequote_test and unrelated names remain rejected. Partial maintenance failure is a visible stop, never an excuse to drop/reset data or use the owner role in the app.

## Private local credential cleanup

Temporary plaintext/encrypted handoffs and cloud helper scripts were removed. Generated runtime/demo/session credentials are retained only in ignored `.env.cloud-secrets.dpapi`, encrypted with Windows DPAPI for the local user; do not commit/upload it. It contains no maintenance URL. Session-memory copies/cached dashboard states were cleared. No cloud was contacted to perform cleanup.

A previous owner-connection-string exposure was reported during provisioning. Owner-password reset confirmation was not verified in this local-only checkpoint; resolve that privately outside this task. Never reproduce the exposed value. Deleting temporary files cannot retract a prior disclosure.

## Release verification still required

No public URL, Render authentication, HTTPS proxy or production Gemini success is claimed. In the next authorized deployment window verify:

1. /api/health/live returns 200 without DB/session work; /api/health/ready returns 200 only with reachable DB and migration 006 (for the T04 release).
2. React and its assets load from the same public origin; built assets contain no source secrets.
3. Both demo identities sign in; cookie is __Host-forgequote.sid with Secure, HttpOnly, SameSite=Lax and Path=/.
4. Missing/wrong Origin or CSRF returns 403; anonymous writes return 401; sales-head quotation writes return 403.
5. Synthetic RFQ create/reopen and complete two-part quotation save/reopen/replay work without duplicate versions; changed same-key content returns 409.
6. Strict cloud ownership/privileges remain restricted; no maintenance credentials are installed in Render.

A separate Gemini check must use explicit consent and synthetic text, verify project billing/data-handling status first, then inspect verified fields and manual fallback. Do not claim paid-tier document handling from key/model connectivity. No Gemini call was made in this deployment checkpoint.

## Verification evidence

Full local regressions passed: 78 unit/config/costing, 33 dedicated costing, 104 PostgreSQL, all six Chrome suites, 40 API syntax modules and production startup 1/1. All nine goldens remain unchanged. Disposable fixtures and their parent database were removed. Final local build/unit/syntax/startup results are recorded in docs/t07-handoff.md. No approval/PDF or unrelated feature work.


## T04 release gate - not executed against cloud

Owner reports the existing Render + Neon deployment live as of 2026-11-04. T04 was implemented/tested locally only and is not deployed. Do not deploy this branch against an 001-005 database: readiness now requires 006_quotation_events.sql and lifecycle queries require its table.

A separate controlled maintenance step must apply only pending migration 006 with the existing checksum runner, apply the reviewed runtime column grants and grant guard_quotation_event() EXECUTE (existing prepare-cloud tooling performs these explicit steps after target/ownership checks). Review the diff and target privately before that future operation. Existing snapshots/migrations 001-005 remain untouched; no reset, owner transfer or seed-password reset is needed. Updated strict inventory: 17 tables, five guard functions, 30 enabled triggers. Runtime still never migrates or seeds automatically.

After that separately authorized migration/grant step and release, verify readiness, both-role login, below/equal clearance and above-threshold review, rejection reason, issue/replay/stable number and stale-version denial. PDF remains unimplemented. An application rollback can leave the additive event schema intact; retain event history and never reverse by dropping historical events. Any cloud backup/migration/deployment procedure remains outside the completed local T04 action.


## T05 PDF packaging - local verification only

T05 adds no migration, grants, environment setting or Render configuration. Its authenticated PDF path requires the existing T04/006 schema and a current issued version. Include committed apps/api/assets/fonts/NotoSans-Regular.ttf, NotoSans-Bold.ttf and OFL/license notices in the release checkout; npm ci uses pinned PDFKit/fontkit from the lockfile. These are pure Node runtime libraries; no Chromium, Python, PDFium, Poppler, system fonts, native renderer or document service is needed by production PDF generation. The dev-only PDF.js parser is used in tests.

Before a separately authorized release, retain the T04 migration/grant/readiness checks, run the existing build/startup gates, then verify an issued attachment download for both demo roles and denial for stale/unissued versions. Unsupported characters return a visible 422; do not install an unreviewed fallback font or recalculate data to force output. T05 performed no Neon/Render access, migration or deployment. Details: docs/t05-handoff.md and ADR-0015.


## T06 rate catalogue and UX - no cloud action performed

Owner reports T01-T05 merged/deployed and live approval/issuance/PDF manual testing passed. T06 adds authenticated rate reads and frontend intake improvements only. No migration, new environment variable, dependency or runtime permission is required; the existing 006 schema and exact SELECT-only rate grants remain. Do not grant rate INSERT or substitute maintenance credentials to enable an editor: new-version authoring requires a separately approved writer and validated maintenance contract. T06 did not access or change Neon/Render, push/merge or deploy. Before a future authorized release, run the standard build/startup and both-role catalogue/intake smoke checks. Details: docs/t06-handoff.md and ADR-0016.


## Final requirements - migration 007 required; local only

The resumed approved branch adds 007_final_requirements.sql: preserved legacy rates plus raw-value/author/reason/request provenance and guarded append-only RFQ outcomes. Application readiness now requires 007. Before a future separately authorized release, apply only pending migrations with the checksum runner, reapply reviewed runtime-grants.sql and function permissions using maintenance credentials, then run the strict direct-runtime LOGIN checker. Do not deploy the new app against a 006-only schema.

Expected strict inventory: 18 tables, seven guard functions, 34 enabled triggers. Runtime receives rate INSERT only for id/key/start/raw text/actor/reason/request and outcome INSERT only for RFQ/outcome/actor/reason/request; no rate value/timestamp or outcome timestamp insertion, UPDATE/DELETE/TRUNCATE, new ownership or elevated login. New functions guard_rate_authoring() and guard_rfq_outcome() need the same explicit function ACL handling as existing guards. No new dependency, environment variable, hosting configuration or automatic runtime migration. Internal PDFs use the existing bundled Node renderer/fonts.

Only disposable local databases were migrated, granted and checked. No Neon/Render operation, deployment, push or merge was performed. Handoff/limits: docs/final-requirements-handoff.md and ADR-0017. Earlier T06 SELECT-only guidance is superseded solely by this approved narrow version-authoring contract.

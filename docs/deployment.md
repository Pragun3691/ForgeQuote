# Deployment preparation — not deployed

Milestone 8 prepares **Render Free web + Neon Free PostgreSQL**, one Express service serving the React build on the same HTTPS origin. The owner approved preparation only: no accounts accessed, resources created, services purchased or deployment performed. Cloud resource creation/deployment requires access and another explicit authorization. No paid fallback is approved. Existing local database ownership must remain unchanged. The separately owner-approved stabilization applies unchanged migration 005 and reviewed grants to forgequote_dev only; it does not authorize changing forgequote_test, MedReach or cloud databases.

## Exact Render settings - future authorized action only

| Setting | Value |
| --- | --- |
| Service | One Web Service; Node runtime; **Free** plan |
| Repository root | Repository root, not apps/api (npm workspaces/build need both apps) |
| Branch | feature/T01-thin-slice; deploy only the reviewed commit |
| Node | **24.20.0**, pinned in .node-version and NODE_VERSION |
| Region | Singapore in render.yaml; choose a nearby available Neon region |
| Build | `npm ci --include=dev && npm run build` |
| Start | `npm start` |
| Health check | `/api/health/live` |
| Auto-deploy | Off (`autoDeployTrigger: "off"`); initial resource creation can still start a deployment |
| Port | Render-provided PORT; Express binds the platform port |
| Predeploy/migrate/seed | None in the web service; perform separately with maintenance credentials |

render.yaml contains no Render database, paid instance, worker or disk. Validate it with the provider before creation after access/approval; it has not been applied or validated through a hosting account. React dist is built on Render and served by Express. Production refuses a missing dist/index.html. Do not ship a local .env or compiled source containing secret values.

## Neon setup - exact ordered procedure

These are **future manual steps**, not completed cloud actions. Use a fresh Neon Free project/database, not a local database, trial/claimable temporary database, existing user database or paid plan. Keep the default Neon owner as maintenance. Create a dedicated database **forgequote_demo** owned by that identity. PostgreSQL 17 is the locally tested version; migrations require PostgreSQL 13+.

1. Confirm the Neon host, database name and maintenance identity. Use a direct connection hostname (no `-pooler` alias) for both credentials during setup. In a private maintenance shell supply MIGRATION_DATABASE_URL and verify the target using `psql "$env:MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1` followed by `\conninfo`. Require certificate-validated TLS (`sslmode=verify-full` for psql). Do not put secrets in command files, Git or frontend VITE variables.
2. Through **SQL**, create the runtime login below. Do not use Neon's console/API role-creation path, which grants elevated membership. If the role already exists, stop and verify its provenance/credentials; do not reset an unknown existing role. The transaction/target check below prevents applying it to the preserved local database names. Run it only on the fresh Neon endpoint.

```sql
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'forgequote_demo' THEN
    RAISE EXCEPTION 'Wrong database: expected fresh forgequote_demo';
  END IF;
END $$;
CREATE ROLE forgequote_app LOGIN NOINHERIT NOSUPERUSER
  NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
```

```text
\password forgequote_app
```

```sql
COMMIT;
SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls
FROM pg_roles WHERE rolname='forgequote_app';
SELECT parent.rolname
FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid
JOIN pg_roles child ON child.oid=m.member WHERE child.rolname='forgequote_app';
```

The membership query must return no rows. `\password` prompts privately; never commit the real password. Create DATABASE_URL for forgequote_app using the same direct host/port/database and a URL-encoded password. Keep the owner URL only in MIGRATION_DATABASE_URL. Neither URL should point at forgequote_dev, forgequote_test or MedReach.

3. In the maintenance shell set the following names (no values belong in source): DATABASE_URL (runtime URL), MIGRATION_DATABASE_URL (owner URL), CLOUD_DATABASE_NAME=forgequote_demo, DATABASE_TLS_MODE=verify-full and NODE_ENV=production. Maintenance CLIs use readConfig, not the app-only secret exclusion check. Production skips repository .env loading, so all cloud settings must be explicitly supplied; it cannot accidentally borrow local database credentials. DATABASE_CA_CERT is optional trusted PEM roots when needed; normally leave it unset for Neon's publicly trusted certificate.
4. Run from the repository root (use npm instead of npm.cmd on Linux/macOS):

```powershell
npm.cmd run db:prepare-cloud
npm.cmd run db:check-cloud-permissions
npm.cmd run db:seed
# Supply distinct DEMO_ESTIMATOR_PASSWORD and DEMO_SALES_HEAD_PASSWORD privately:
npm.cmd run db:seed-users
npm.cmd run db:check-cloud-permissions
```

The preparation command requires the maintenance identity to own the fresh database and existing application objects. It refuses the preserved local names, a mismatched connected database, unexpected public objects or elevated runtime memberships. It does **not** create/reset credentials, transfer ownership or reset data. It hardens only this dedicated database's namespace/default privileges, runs checksummed migrations 001-005, and applies existing runtime-grants.sql plus specific function/domain privileges. Repeating setup/seed is safe and tested. Namespace, migrations and grants are separate transactions: on a partial failure stop, fix the cause and repeat; never drop/reset as a fallback. The application must remain unpublished until the strict checker succeeds.

5. Verify role ownership/permission output is restricted, inspect synthetic fixtures and remove maintenance/test/seed credentials from the later Render environment. Close the maintenance shell when finished. Keep the maintenance secret separately for future explicit migration/seed/check operations. Never rotate/reset existing demo passwords through repeat seed; the existing seed deliberately refuses drift.

## Current migration 005 object inventory

Current readiness requires 005_rfq_intake.sql. Migrations 001-004 remain unchanged. Migration 005 adds the maintenance-owned rfq_submissions receipt table, its foreign keys/uniqueness checks and two immutable/no-truncate triggers. Apply existing reviewed runtime-grants.sql after migration; it adds receipt SELECT and column-specific INSERT plus RFQ/part/initial-route INSERT. It grants no owner/status/timestamp overrides or rate/history updates.

The strict checker expects **16 tables, 27 triggers, four application functions**, the rate_periods view and quote_amount domain. Tables: rate_keys, rate_versions, rfqs, rfq_parts, routing_revisions, schema_migrations, users, sessions, quotations, quotation_versions, quotation_parts, quotation_rates, quotation_part_tiers, quotation_totals, draft_submissions, rfq_submissions. Functions: reject_history_mutation, guard_quote_assembly, guard_quote_header, guard_draft_submission. Trigger inventory is authoritative in apps/api/src/cloud-database.js; the two receipt guards bring the prior 25 to 27. Existing owner DDL powers are not removed by grants; a successful local grant check is not proof of safe public deployment.

For the explicitly approved local stabilization only, verify both connections resolve to local forgequote_dev with distinct actual maintenance/runtime identities, 001-004 checksums match and only 005 is pending. Use npm.cmd run db:migrate, then npm.cmd run db:grant-runtime, then npm.cmd run db:check-permissions. Verify readiness and a synthetic RFQ create/reopen. Do not use cloud preparation on local development, reset data or transfer ownership. This is not standing authorization to migrate any other database.

Local verification on 2026-11-03: 005 and reviewed grants applied successfully; readiness and login returned 200. RFQ creation returned 503 with SQLSTATE 42501 on users; reopening a newly created RFQ could not be verified. The runtime still owns users/sessions; users has SELECT but lacks UPDATE, and EXPLAIN SELECT ... FOR KEY SHARE on users fails 42501. The receipt foreign-key check is therefore blocked by the existing ownership/privilege combination. No partial RFQ/receipt was saved, no existing ownership changed, and existing non-session data was preserved. Further development writes stopped; resolving permissions requires a separately approved correction. A passing grant checker alone does not prove the application save path works.

Subsequent owner-approved correction resolved that local blocker: runtime-grants.sql now grants UPDATE(id) on users **only when runtime already owns that table**. No password/role/activation writes or table-wide UPDATE/DELETE are granted. Maintenance-owned users retains SELECT-only runtime access; strict cloud isolation remains unchanged. The exact local checker accepts this single column only under the ownership condition. Actual development create/reopen/retry/conflict/authorization checks passed; existing data/ownership were preserved. This ACL also permits direct SQL updates of users.id and is a local compatibility exception, not a locking-only privilege or a substitute for safe ownership. See ADR-0011 and docs/dev-rfq-permission-handoff.md. No cloud grant operation or deployment occurred.

## Render environment

| Name | Intended value/source |
| --- | --- |
| NODE_VERSION | 24.20.0 |
| NODE_ENV | production |
| DATABASE_URL | Restricted SQL-created runtime login, fresh Neon database; never owner URL |
| DATABASE_TLS_MODE | verify-full |
| DATABASE_CA_CERT | Optional trusted PEM CA; normally unset |
| SESSION_SECRET | Stable random secret, >=32 bytes; Blueprint generateValue produces a 256-bit value |
| APP_ORIGIN | Exact assigned HTTPS origin, without path/trailing slash |
| TRUST_PROXY_HOPS | 1 for the verified Render edge path only |
| DEMO_GST_PERCENT | 18, explicitly illustrative |
| PORT | Platform-provided |

DATABASE_URL and APP_ORIGIN are `sync: false` prompts on initial Blueprint creation. Determine the real assigned HTTPS URL; never use a guessed/placeholder origin. If the URL is available only after service creation, configure APP_ORIGIN and redeploy before any handoff; a missing value correctly prevents startup. New `sync: false` values on an existing service must be configured manually. Keep SESSION_SECRET stable across restarts and routine deploys; a deliberate rotation invalidates sessions.

Do **not** put MIGRATION_DATABASE_URL, TEST_DATABASE_URL or either DEMO_*_PASSWORD in the production application environment: startup rejects them. CLOUD_DATABASE_NAME is a maintenance/preflight setting, not required by Render. Do not set NODE_TLS_REJECT_UNAUTHORIZED=0, rejectUnauthorized:false or production DATABASE_TLS_MODE=disable. No AI keys are required. Secrets stay in provider settings/private maintenance environment, never a tracked .env, source ZIP or frontend bundle.

## Permission contract

Maintenance owns/manages schema objects. Runtime owns no database/schema/table/index/view/function/domain and has no owner/neon_superuser membership or role/database creation powers. It receives database CONNECT and public USAGE; users/RFQ/routing/rates/ledger/view SELECT; sessions CRUD; snapshot SELECT/INSERT; narrowly scoped header INSERT/counter UPDATE; version and receipt column INSERT. No history UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES or schema CREATE/TEMP. There are no sequence grants because current IDs are UUIDs. The four guard functions and quote_amount domain receive explicit EXECUTE/USAGE.

`db:check-cloud-permissions` checks all of this plus the 27 expected enabled triggers. `db:check-permissions` is the legacy local grant checker and still reports the intentionally preserved local users/sessions ownership limitation. Do not confuse that legacy result with cloud isolation. Keep future migrations maintenance-owned and add grants explicitly; no blanket default runtime writes.

The current local ownership issue is not repaired or used for deployment: cloud data starts fresh from synthetic seeds. No local histories/password hashes/drawings are imported. Existing formulas, migrations, snapshots and goldens remain unchanged. Any later cross-cluster restore needs a separate rehearsal/review of transaction-ID-based assembly guards; this milestone makes no historical restore guarantee.

## Health, logs and limits

Render must probe `/api/health/live`: no DB query, session lookup or cookie. It indicates only a responsive process. `/api/health/ready` separately checks the database and migration 004; use it for release/diagnostics rather than frequent free-tier probes. Frequent DB readiness calls can keep serverless compute awake. Session pruning still queries the database periodically while the app is running.

Production request logs allow only request ID, method, registered route pattern, status, duration and known response code. Successful liveness probes are suppressed. No raw paths/queries, bodies, passwords, cookies, tokens, document contents, SQL messages or stack traces are serialized. Existing database/session error logs are generic. This is minimal diagnosis, not durable centralized observability or financial audit logging. Snapshot tables remain the business record.

Quotation writes are limited per estimator to 30 attempts/15 minutes in this single process. Invalid role/CSRF is rejected before the limiter. Replays count; 429/Retry-After must retain the pending key/body and be retried explicitly later. Login throttling remains 10/IP/15 minutes. Both stores reset on process restart and need shared storage before multiple instances. No automated POST replay is added.

Free-plan facts checked from provider documentation on 2026-11-02: [Render Free](https://render.com/docs/free) sleeps after 15 idle minutes with about a one-minute wake and has shared instance/build/bandwidth limits. This plan does not use its expiring free PostgreSQL. [Neon Free](https://neon.com/pricing) includes 1 GB/project and 100 CU-hours/project/month, scales idle compute to zero and suspends compute on exhausted compute/network quotas. Neon is not the Render 30-day database trial, but it still provides no uninterrupted-demo guarantee. Check actual account allowance/region before creation. No artificial keep-alives, paid upgrades, extra domains/services or billing assumptions.

## Verification and release gates

Historical milestone-8 results (before T02; current stabilization evidence is in docs/current-status.md): 45 unit/config/API tests, 50 reported PostgreSQL tests, 33 costing tests, frontend build, 30 API module syntax checks, one actual production-server startup test and both Chrome suites passed. Fresh-database tests used real separate LOGIN credentials, not SET ROLE impersonation, and verified preserved local database ownership/ACLs before/after. OpenSSL on PATH is required for ephemeral TLS transport tests. See milestone-8-handoff.md for exact evidence and files.

```powershell
npm.cmd test
npm.cmd run test:costing
npm.cmd run test:db
npm.cmd run check:api
npm.cmd run build
npm.cmd run test:production
npm.cmd run test:browser
npm.cmd run test:browser:quotation
```

After future resource/deployment approval, verify the actual Neon TLS connection and strict cloud permissions, then the assigned Render origin/proxy path, Secure HTTP-only __Host cookie, login/logout, expiry, anonymous/role/CSRF rejection, 119.76/149.70 saved spindle baseline, all scenarios/GST/provenance, same-key replay/conflict/concurrency, refresh and real service restart. Confirm no secret values in tracked source/build/logs and record quotas and evaluation retention dates. Do not announce a live demo until these public-URL checks pass. No deployed HTTPS, Neon execution, public uptime, restore/backup or load-test claim is made now.

References: [Render Blueprint spec](https://render.com/docs/blueprint-spec), [Node pinning](https://render.com/docs/node-version), [Neon SQL roles](https://neon.com/docs/manage/roles), [node-postgres SSL URL caveat](https://node-postgres.com/features/ssl). STOP before external account/resource/deployment actions or later AI/approval/rate-management/PDF features.

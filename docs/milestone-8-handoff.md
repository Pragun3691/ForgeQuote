# T01 Milestone 8 preparation handoff - 2026-11-02

Starting HEAD: 230254a9fe91baf8d8ae65f32a5d2c3dbc8fbd0d on feature/T01-thin-slice. Deployment preparation is implemented and tested locally. **No hosting accounts accessed, cloud resources created, services purchased or app deployed.** Stop pending access and explicit deployment/resource authorization.

Commits:

- 4f40ba0 - verified production PostgreSQL TLS, tested Node pin and production environment safeguards.
- 96f1917 - database-free liveness, redacted request/error metadata and quotation-write limiter.
- 4c7d626 - fresh-cloud setup/grants, strict permission checker, free Render config and tests.
- aa6852f - reject privileged LOGIN credentials hidden by SET ROLE; clean up only fixture resources actually created.
- Documentation committed separately; final HEAD is reported in chat.

## Actual test outcomes

| Check | Actual result |
| --- | --- |
| npm.cmd test | 45/45 passed, including unchanged financial expectations, strict TLS/config and redaction/liveness checks |
| npm.cmd run test:costing | 33/33 passed; all nine golden cases unchanged |
| npm.cmd run test:db | 50/50 reported passed (45 subtests + 5 parents), including auth, rates, snapshots, idempotency, limiter and fresh-database isolation |
| node --test apps/api/test/cloud-database.test.js | Final focused run 5/5 passed, including real CLI repeat/setup/check and missing-trigger detection |
| npm.cmd run build | Production React build passed using Node v24.20.0 |
| npm.cmd run check:api | 30 API source/maintenance modules passed Node syntax checks; backend is plain JS, no transpilation needed |
| npm.cmd run test:production | 1/1 passed: actual NODE_ENV=production child server, React page/JS assets, DB-free liveness and honest unavailable-DB readiness |
| npm.cmd run test:browser | Actual Chrome auth smoke passed: wrong password, both roles, refresh/logout, HTTP-only cookie and mobile viewport |
| npm.cmd run test:browser:quotation | Actual Chrome quotation workflow passed: saved 119.76/149.70 baseline, three scenarios/provenance, empty/invalid/missing-rate states, refresh, full process restart, lost committed response/replay, expiry recovery, sales-head 403, anonymous 401, malformed storage and 390px layout |
| npm.cmd run db:check-permissions | Existing local grants check passed and still reports users/sessions ownership limitation; read-only operation |
| git diff --check | Passed |
| Diff against 230254a for migrations 001-004, engine, costing tests/golden fixture/spec/golden docs | No changes |

Fresh-database tests used generated local owner/runtime LOGIN credentials and an isolated database named forgequote_m8_<random>_test. Migrations 001-004 and seeds worked twice without resetting rows/password hashes. Runtime could authenticate, persist sessions, read RFQs/rate_periods and save/replay complete quotes with functions, domain and triggers active. The fixture database and generated roles were removed; preserved local dev/test ownership/public ACL/relation-owner snapshots were equal before/after. No MedReach access or ownership migration was performed.

Security denials passed for CREATE SCHEMA/TABLE/TEMP, DROP TABLE/VIEW/FUNCTION, trigger deletion/disabling, function/domain alteration, session_replication_role, owner SET ROLE/membership grant, master-rate insertion and protected user/history mutation. An ineffective self-grant was verified not to elevate permissions. Strict preflight checks every expected grant and all 25 triggers, and detects a deliberately removed trigger in the disposable fixture. Three concurrent same-key requests under real runtime LOGIN credentials produced one version (one 201, two 200). Existing six-request idempotency regression also remains passing. Limiter test returned 429 without changing records or submission key; same key recovered as a replay through an unexhausted limiter.

TLS tests use pg's real SSL negotiation with ephemeral test certificates (OpenSSL required on PATH). Trusted CA/hostname succeeded; untrusted CA, wrong hostname and plaintext-only peers failed. Ephemeral keys were deleted from the ignored workspace test directory and never committed. This verifies the client transport policy, not a live Neon connection. Production cookie/proxy tests still simulate trusted HTTPS headers; no deployed TLS/browser verification is claimed. Critical Blueprint configuration fields are covered by local tests and checked against the public Render reference/schema; no full provider/account validation is claimed, and that step remains manual.

## Exact Render settings

See render.yaml and deployment.md. One free web service, repository root directory, branch feature/T01-thin-slice, Node runtime 24.20.0, region Singapore (select a nearby Neon region later), autoDeployTrigger off. Build `npm ci --include=dev && npm run build`; start `npm start`; health path `/api/health/live`. No migration/seed/predeploy command or owner credential in the web service. Provider supplies PORT. Express serves the React build on the same origin.

## Exact Neon procedure and environment separation

The full ordered SQL/CLI procedure is in deployment.md. After future account/resource approval: create a fresh dedicated Neon Free database forgequote_demo owned by maintenance; create forgequote_app with SQL and no elevated memberships; configure direct same-host/database role URLs; run db:prepare-cloud, seed RFQ/users, then db:check-cloud-permissions. Do not run the cloud setup on existing local databases. Setup never creates/resets roles/passwords or transfers ownership.

Runtime names: NODE_VERSION, NODE_ENV, PORT (platform), DATABASE_URL, DATABASE_TLS_MODE, SESSION_SECRET, APP_ORIGIN, TRUST_PROXY_HOPS, DEMO_GST_PERCENT. DATABASE_CA_CERT is optional trusted PEM CA configuration. Maintenance-only names: MIGRATION_DATABASE_URL, CLOUD_DATABASE_NAME, DEMO_ESTIMATOR_PASSWORD, DEMO_SALES_HEAD_PASSWORD, plus the runtime role URL in DATABASE_URL for target/role verification and the same TLS settings. TEST_DATABASE_URL is local/CI only. Production application rejects maintenance/test/seed credentials and skips local .env auto-loading. Never set NODE_TLS_REJECT_UNAUTHORIZED=0 or commit values. No new AI/provider keys are needed.

## Remaining manual work / limits

Provide account/repository access and explicit approval before creating Neon/Render resources or deploying. Then verify provider plan/region/account quotas, SQL role creation capability, actual Neon TLS connection, exact APP_ORIGIN, trusted proxy behavior, secure cookies and the full browser workflow on the public URL. Retain secrets through the provider's secret settings and keep the session secret stable. Do not publish the app until strict cloud permission checks pass.

Free cold starts/quota suspensions remain. DB-free liveness avoids frequent readiness queries keeping Neon awake; periodic session pruning and actual requests still consume compute. No paid fallback is authorized. Existing local database/auth ownership remains unchanged and is not presented as deployment-safe; fresh cloud isolation is separate. No cross-cluster historical restore guarantee, production backup/uptime/SLA or load-test claim. Same-key recovery remains per browser tab; both roles read all demo drafts. Single-instance limiters require redesign only if later scaling to multiple instances. No later AI/approval/rate-management/PDF features were started.

## Exact changed-file manifest

```text
.env.example
.node-version
README.md
apps/api/package.json
apps/api/scripts/check-cloud-permissions.js
apps/api/scripts/check-syntax.js
apps/api/scripts/prepare-cloud.js
apps/api/src/app.js
apps/api/src/auth/middleware.js
apps/api/src/cloud-database.js
apps/api/src/config.js
apps/api/src/database-config.js
apps/api/src/db.js
apps/api/src/errors.js
apps/api/src/quotation-routes.js
apps/api/src/request-logging.js
apps/api/src/server.js
apps/api/test/cloud-database.test.js
apps/api/test/deployment.test.js
apps/api/test/production.test.js
apps/api/test/quotation-api.test.js
apps/api/test/tls.test.js
docs/architecture.md
docs/current-status.md
docs/decisions/0007-free-deployment-preparation.md
docs/deployment.md
docs/learning-log.md
docs/milestone-8-handoff.md
docs/risks.md
package.json
render.yaml
tasks/T01-thin-slice.md
```

## Owner understanding questions

1. Why can the legacy local grants check pass while local ownership is still unsafe, and what does the fresh-cloud checker additionally prove?
2. Why are TLS URL flags normalized, and why must Render receive a runtime URL rather than the maintenance/owner URL?
3. Why should frequent free-tier health probes use liveness instead of database readiness, and why must 429/network failures retain the same submission key?

# ADR-0007 - Prepare Render Free and a fresh Neon Free database

- Status: ACCEPTED implementation of the owner's modified Milestone 8 authorization, 2026-11-02.
- Scope: deployment-ready code, isolated tests and instructions only. No hosting-account access, cloud resource creation, paid plan, purchase or deployment. Later actions require access and explicit owner authorization.
- The owner's modification supersedes the earlier local ownership-remediation proposal: preserve forgequote_dev and forgequote_test ownership/ACLs, do not touch MedReach or other existing databases. Use fresh synthetic cloud data with unchanged migrations 001-004 and seeds.

## Deployment shape

One Render Free Node web service serves Express /api and the Vite React build on one HTTPS origin. Neon Free holds the database and sessions. No separate frontend service, Render Postgres, Redis, worker or persistent disk. render.yaml declares only the free web service, Singapore region, explicit branch, manually triggered deployments and database-free health checks. Importing/applying it creates resources and is not authorized yet. Node is pinned to the locally tested 24.20.0 in .node-version and Blueprint settings; root engines retain the supported >=24 <25 range.

Build: npm ci --include=dev && npm run build. Start: npm start. Production startup refuses a missing React build. Runtime does not migrate or seed. Production does not auto-load a local .env and rejects maintenance/test URLs or demo seed passwords in its application environment. Platform/runtime secrets are supplied separately from one-off maintenance secrets. SESSION_SECRET must remain stable across restarts/deploys.

## TLS and same-origin security

database-config.js supplies one policy for runtime/maintenance pools. Production requires verify-full TLS with rejectUnauthorized:true and TLS 1.2 minimum. URL sslmode=require/verify-ca is upgraded to full certificate/hostname verification; SSL flags are removed before pg parses the URL so they cannot override the explicit SSL object. Conflicting/no-verify/prefer modes and URL certificate overrides are rejected. DATABASE_CA_CERT optionally supplies trusted PEM roots; ordinary Neon public certificates should use Node's standard trust store. No global verification bypass is set; NODE_TLS_REJECT_UNAUTHORIZED=0 is rejected in production.

Use the same Neon direct hostname/port/database for both role URLs, preserving the existing maintenance URL guard. The runtime user/password differ from maintenance. Do not use the owner connection string as Render DATABASE_URL and do not use a pooled alias for one URL and direct alias for the other. Real pg transport tests verified trusted TLS success and rejection of untrusted certificates, wrong hostnames and plaintext negotiation. Actual Neon connection verification awaits access.

HTTPS APP_ORIGIN remains exact and explicit: no path/trailing slash, and no derivation from untrusted headers. Existing __Host-forgequote.sid, Secure, HttpOnly, SameSite=Lax, Path=/, session regeneration, eight-hour expiry and CSRF checks remain unchanged. TRUST_PROXY_HOPS=1 is intended for the Render edge path; verify the actual forwarding chain and forwarded-proto behavior before sharing the app. No extra proxy/custom domain is added now.

## Fresh database ownership and permissions

The owner first provisions a dedicated database named forgequote_demo owned by the maintenance identity and creates forgequote_app via SQL with LOGIN, NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION and NOBYPASSRLS. No owner/neon_superuser membership. Neon console/API-created roles receive elevated membership, so use SQL for runtime (official roles documentation linked in deployment.md).

db:prepare-cloud requires CLOUD_DATABASE_NAME to match the connected URL/database and a restricted role that already exists. It refuses the preserved forgequote_dev/forgequote_test names, unrelated names, a non-owner maintenance identity, unexpected public objects or objects owned by another identity. It does not create/reset passwords, transfer ownership, drop data or contact provider APIs.

Preparation has three recoverable stages: namespace/default ACL transaction; unchanged atomic/checksummed migration runner; runtime/function/domain grants transaction. If a stage fails, stop before deployment; fix the preflight/connection issue and repeat. No destructive fallback. Repeated setup/seed preserves existing rows/hashes. The namespace transaction removes runtime/PUBLIC CREATE and TEMP, grants runtime CONNECT/USAGE, and makes future functions/types private by default. Existing runtime-grants.sql is reused unchanged. Only the four guard functions and quote_amount domain get explicit runtime EXECUTE/USAGE. Future migrations must review and add specific grants; no blanket future writes.

db:check-cloud-permissions is a stricter preflight than the preserved legacy local checker: checks login flags/membership, no database/schema/object ownership, no CREATE/TEMP/TRIGGER/REFERENCES rights, exact table and column INSERT/UPDATE permissions, function/domain access and all 25 expected enabled application triggers. The legacy db:check-permissions still reports the intentionally unchanged local ownership limitation. Its success alone is not a cloud isolation claim.

Tests create a uniquely named disposable local database and two real password LOGIN roles, run the production setup functions and CLIs, migrate/seed twice, authenticate, persist/replay a complete quote and test actual privilege denials. Cleanup removes only the generated database/roles. Before/after snapshots confirm existing development/test database ownership, public ACLs and relation ownership are unchanged. No existing database ownership was altered.

## Health, logs and abuse controls

GET /api/health/live precedes sessions/auth and returns process liveness without any database query/session cookie. Render uses this path, so frequent probes do not keep Neon compute awake. GET /api/health/ready separately verifies PostgreSQL and migration 004; use it as a manual release/diagnostic gate, not frequent free-tier monitoring. Liveness does not claim database health. Existing periodic session pruning still uses the DB while the process is running.

Production request logs contain only a server-generated request ID, allowlisted method, registered route pattern (never raw URL/query/parameter values), response status, duration and known response error code. Successful liveness probes are omitted. Bodies, passwords, cookies, tokens, document data, database URLs, SQL errors and error stacks are not serialized. Logging failure does not replay or fail a committed write. X-Request-Id supports support/debug correlation. Provider logs remain limited observability, not a financial audit log; persisted snapshots are the business evidence.

Quotation POST has a process-local limit of 30 authenticated estimator attempts per 15 minutes, after role/CSRF checks and before the submission transaction. Replays count too. HTTP 429 includes Retry-After and instructs same-key retry. Throttling never deletes a receipt or changes keys. The browser already retains pending inputs/key on 429. Existing login limiting remains unchanged. One instance only; shared limiting is required before horizontal scaling.

## Limits and future work

Free Render has cold starts and usage limits; Neon has compute/transfer/storage quotas and a short restore window. No always-available/SLA claim, artificial keep-alive, paid fallback or production backup claim. Account/project creation, certificate/network checks, exact assigned APP_ORIGIN, provider Blueprint validation and real deployed-browser smoke remain manual after explicit approval.

Fresh synthetic cloud initialization does not import local quotes/users/password hashes. Cross-cluster history restore is unverified: creation_xid-based assembly guards need a dedicated restore rehearsal/review before relying on historical import or recovery. No migration rewrite or speculative sealing redesign is included in this milestone.

Both active demo roles still read all RFQs/drafts; no tenant isolation. Runtime credentials remain trusted: compromised SQL credentials with INSERT/session permissions could fabricate new data. The new isolation prevents DDL/history mutation, not every consequence of credential theft. No AI, approvals, rate-management, multi-part HTTP or PDF features are added. The single Express/PostgreSQL structure can add those through later reviewed migrations/grants and, if needed, object storage/workers; do not pre-provision them now.

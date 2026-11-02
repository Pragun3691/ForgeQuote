# Architecture - current slice and future scope

Current checkpoint: Milestone 8 prepares one Render Free Express/React service and a fresh Neon Free database, without creating resources or deploying. The implemented product remains the Milestone 7 login -> RFQ -> idempotent POST -> immutable snapshot -> saved GET workflow. The diagram below also includes future scope; approvals, intake AI and PDF are not implemented. See milestone-8-handoff.md and deployment.md for prepared settings and actual verification.

```text
Estimator/Sales Head React UI
          |
  Express API (session authentication, authorization, validation)
     |         |           |               |
  RFQ CRUD  costing      approvals       intake AI
     |       engine          |          (document parser, evidence)
     +---------+-------------+---------------+
               |
           PostgreSQL
  users, rfqs, parts, rate_versions, quote_versions,
  quote_lines, approval_events, extraction_runs
               |
    server PDF renderer consumes frozen quote snapshot
```

**Transaction invariants:** approving a quote must compare the current quote version; publishing and approving must not overwrite the snapshot. Rate selection uses effective date and must fail if no rate. Split user-entered RFQ facts, AI suggestions, approved inputs and calculated results.

**First slice:** One part, seeded material and machine rates, a small RFQ form, POST calculate on backend, persist quote draft, retrieve and display. Defer AI, permissions polish and PDF to later slices. Have an online deployed URL and DB from the start, not an all-local app until Nov 6.

**Schema design follows the approved costing spec.** Entity names here are conceptual, not final migration contracts.

## Authorized T01 checkpoint

React/Vite JavaScript and Express share one production origin. pg for PostgreSQL; decimal.js for finance. Milestones 1-3 cover workspace, schema and synthetic data only. No public writes. Milestone 4 adds persistent sessions and roles. AI, approvals and PDF deferred.

Rates use unique effective starts and derived ends (ADR-0003); routing revisions append-only. Future snapshots retain inputs, rate IDs/values, routing, date, formula, results and illustrative 18% GST. Baseline edits change quote inputs, not RFQ facts.

Milestone 6 quote transactions: READ COMMITTED; insert/lock the RFQ's unique quotation header and increment its counter; resolve dependencies in one statement; calculate in the existing engine and insert atomically. No automatic retries, including after uncertain COMMIT. See ADR-0005 for the future HTTP submission-key contract.

## Milestone 4 authentication

Implemented: React login/logout -> same-origin Express -> session/user lookup in PostgreSQL. Session bootstrapping supplies CSRF; successful password verification regenerates the session ID/token. Backend roles are authoritative; user activation is checked on every authenticated request. See ADR-0004 for hashing, expiry, cookies, throttling and proxy details.

Milestone 6 now adds quotation snapshot tables and separately tests real internal quote-write authorization. No draft URL is implemented; HTTP role/CSRF middleware remains exercised on a test-only probe. Migrations/seeds require a separate maintenance connection; runtime grants are table-specific. Historical ownership is unchanged, including the existing local auth-table ownership limitation documented in ADR-0004. New snapshot tables are maintenance-owned.

## Milestone 5 pure costing

`src/costing/calculate.js` takes validated decimal-string manufacturing inputs/resolved rates, returns versioned three-tier financial results, and imports only decimal.js. No Express, SQL, environment or clock dependency. A separate quotation-total helper aggregates rounded unit prices/quantities before GST. See costing-engine.md for exact API/bounds. The engine remains unchanged in milestone 6.

## Milestone 6 internal quotation service

`src/quotations.js`: trusted actor/config -> DB role check -> header lock/counter -> single master/rate-resolution statement -> pure engine -> atomic immutable snapshot. Tables: quotations -> quotation_versions -> quotation_parts -> quotation_rates/quotation_part_tiers; versions also own quotation_totals. Parts/rates retain both master references and copied data. Numeric JSON inputs are strings and financial SQL outputs use unbounded NUMERIC with exact-paise checks.

Retrieval reads saved snapshots only; explicit diagnostic reproduction dispatches the saved formula version. Transaction-ID child guards prohibit later appends; mutation/truncate guards protect committed history. Service completeness and trusted credentials are explicit boundaries. See quotation-persistence.md and ADR-0005. Milestone 7 subsequently adds the HTTP/UI connection below; no issue/approval or PDF workflow exists.

## Milestone 7 HTTP and React integration

`quotation-routes.js` wraps existing session/role/CSRF protection around RFQ reads and draft writes. `rfqs.js` provides stored inputs/routes/default integer quantities and version metadata. `quotation-request.js` strictly validates and canonicalizes explicit business fields. `draft-submissions.js` owns one transaction for actor/key lock, replay/conflict lookup, quotation creation via shared client and append-only receipt insertion. Migration 004 adds UNIQUE(actor_user_id, submission_key); no generic job framework or automatic retries. See ADR-0006.

React Workspace reads the register/details, accepts date/margin/routing/three quantities and stores exact pending key/body in per-actor/RFQ sessionStorage before POST. Unknown outcomes use explicit same-key recovery. Only Start new calculation generates another key. QuoteResults renders saved GET financial strings and selected rates; hash URLs retain saved version on refresh. Actual Chrome tests verify full API-process restart and loss of a committed POST response followed by refresh/replay. HTTP T01 rejects multi-part RFQs; internal service still supports multiple parts. Subsequent Milestone 8 preparation is described below; no deployment occurred.

## Milestone 8 deployment preparation

Prepared flow: browser HTTPS -> Render edge -> one Express service serving React and /api -> verified TLS -> Neon Free. Runtime receives only its restricted login; maintenance owns the fresh database/schema objects and runs migrations/seeds/explicit grants separately. Local development/test ownership is deliberately preserved; no data/ownership migration into cloud. render.yaml has no database/paid resource and auto-deploy is off. Applying it remains an external action requiring review/access.

database-config.js normalizes SSL URL flags into one strict TLS policy. Production config rejects insecure TLS, local .env loading and maintenance/test/seed credentials. cloud-database.js guards fresh target identity and ownership, applies namespace/default ACLs, invokes unchanged migrations and scopes runtime grants/functions/domain access. checkCloudPermissions verifies direct LOGIN, no owner/elevated access, exact table/column grants and the 25 enabled protection triggers. See ADR-0007.

Frequent /api/health/live checks precede sessions/auth and never query PostgreSQL. /api/health/ready is a separate DB diagnostic/release gate. Production logging allowlists server-generated request ID, registered route, method/status/duration/error code. A per-estimator process-local write limiter runs after role/CSRF and before the idempotent transaction; 429 retains same-key recovery. One instance initially. Actual cloud/HTTPS/region/quota verification and deployment remain pending; no AI/approval/rate-management/PDF services are provisioned.

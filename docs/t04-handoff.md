# T04 handoff - Sales Head approval and controlled issuance

Branch: feature/T04-approval-issuance, from clean/fetched main edc7295 (accepted deployment code). Owner explicitly approved the complete defined scope and commit without another plan round. No push/merge/deployment. This handoff is included in the T04 feature commit.

## Behavior and API

Immutable saved version -> estimator submits -> at/below INR 25,00,000 excluding GST atomically auto-clears; strictly above stays pending -> Sales Head approves or rejects with reason -> estimator issues only a current approved/auto-approved version. Rejected versions require a new costing version to request another review. New versions have no inherited events. Older snapshots/history remain reviewable and can never be approved/issued by a new action after supersession.

| Endpoint | Role | Body / response |
|---|---|---|
| POST /api/quote-versions/:id/submit | estimator | {} -> immutable action receipt |
| GET /api/quote-versions/pending | sales_head | {versions} with exact version, RFQ and saved annual value |
| POST /api/quote-versions/:id/approve | sales_head | {} -> action receipt |
| POST /api/quote-versions/:id/reject | sales_head | {reason: string}, trimmed 1-1000 characters -> action receipt |
| POST /api/quote-versions/:id/issue | estimator | {} -> receipt with stable quotationNumber |
| GET /api/quote-versions/:id/lifecycle | either active role | versionId, derived status, approvalRequired, approvalBasis, stale, quotationNumber, ordered events |

All POST routes use active-role authorization, exact Origin, CSRF and UUID Idempotency-Key; existing quotation action limiter also covers lifecycle writes (30 attempts/actor/15 minutes, including retries). Ordinary 4 KiB request limit retained. Unknown fields/client totals/status/approval flags are rejected. New receipt 201, same-key/same-intent recovery 200, changed key intent/state/stale conflict 409, validation 400, role 403, anonymous/disabled 401, missing version 404, redacted storage failure 503. No automatic COMMIT retries.

Submission/issue reads the stored immutable annual_value_ex_gst, validates it against the stored 100% quotation subtotal and compares with decimal.js. Exactly 2500000.00 does not require review; 2500000.01 does. No money passes through JS binary floats and no AI participates. Financial formulas, GST, rates and quotation persistence service are unchanged.

Every action locks the same existing quotation header as version creation. Unique version/event, position, decision/version, actor/key and quotation-number constraints provide additional database protection. Submitted/clearance events commit together. Existing immutable events act as retry receipts; exact replay is allowed even after a later decision/version and never performs another action. Issuance number FQ-<full version UUID> is stored only on the issued event: stable, globally unique and deliberately nonsequential. ADR-0014 explains the policy and trust boundaries.

## Changed files

- apps/api/db/migrations/006_quotation_events.sql: new append-only events, constraints and current-version/role/transition guard.
- apps/api/src/quotation-lifecycle.js: transactional status/pending/action service; apps/api/src/quotation-routes.js: six protected lifecycle endpoints.
- apps/api/src/app.js and errors.js: 006 readiness gate and controlled conflict errors.
- apps/api/db/runtime-grants.sql, scripts/check-permissions.js, src/cloud-database.js: narrow event INSERT/SELECT, function/inventory/checker updates.
- apps/web/src/QuoteLifecycle.jsx, Workspace.jsx, QuoteResults.jsx and styles.css: pending review list, exact saved-version lifecycle controls/history, same-key recovery and compact responsive presentation. Saved results use a neutral Version label so issued quotes are not incorrectly labeled draft.
- apps/api/test/lifecycle.test.js: thresholds/security/concurrency/stale/rollback/immutability/real low-value fixture; database.test.js, quotations.test.js and cloud-database.test.js: migration/inventory expectations for 006. API package.json adds the lifecycle DB suite.
- tests/browser-lifecycle.smoke.js: new both-role real Chrome workflow; browser-quotation.smoke.js updates neutral labels/current Sales Head wording; root package.json adds test:browser:lifecycle.
- README.md, docs/current-status.md, docs/requirements.md, docs/deployment.md, docs/learning-log.md, docs/decisions/0014-approval-issuance.md, tasks/T04-approval-issuance.md and this handoff.

No dependency, original migration, costing engine/golden fixture, rates, quotation snapshot/persistence, RFQ creation, provider policy, deployment config or credential changes.

## Verification

All commands used local PostgreSQL only. An ignored test launcher verified localhost before creating a uniquely named disposable forgequote_t04_*_test parent, privately passed its URLs to child suites, then dropped that parent. Existing fixtures created/removed their own generated schemas/roles/databases. No migrations/grants/data writes to existing forgequote_dev/forgequote_test or Neon.

- npm.cmd test: 78/78 unit/config/costing/provider/parser checks passed.
- Complete test:db file list, including lifecycle.test.js, in the disposable parent: 115/115 passed. Includes strict fresh-database setup/checker CLIs with real restricted LOGIN roles, all existing persistence/security suites and ten T04 subtests.
- npm.cmd run test:costing: 33/33 passed, all nine original independent golden cases unchanged; persisted multipart goldens also pass.
- All seven Chrome scripts passed: authentication, quotation, manual RFQ, AI, Excel, numbered-part association, lifecycle. AI tests use mocked providers; no live provider call or cloud access. T04 covers estimator save/submit, exact Sales Head version/totals, approve/reject/reason, automatic clearance, issue, superseded view and successful issuance with deliberately lost response followed by refresh/same-key recovery: one issued event, same number.
- npm.cmd run check:api: 41 source/maintenance modules passed; production Vite build passed; npm.cmd run test:production: 1/1 actual local production startup passed; git diff --check passed. Final T04 desktop/mobile screenshots in ignored .tmp/t04-browser/ were visually inspected.

Initial local migration parsing (parenthesized CASE), test-only role mutation incompatible with the existing seeded identity constraint (use deactivation instead), and browser stale-view check needing the explicit Refresh lifecycle action were corrected. Initial sandbox Vite config access denial was resolved by the authorized normal-access local build. Final required checks pass; no unresolved test failure.

## Automatic-clearance demo

Synthetic existing spindle RFQ-2611-014; pricing date 2026-11-02; margin 20%; 50/100/150% quantities 500/1000/1500. Independently checked baseline: INR 3,01,850.00 excluding GST. The database and browser suites create this real fixture with unchanged costing, submit it and issue it. For an interactive demo, select those quantities in the existing UI, save, Submit for clearance, then Issue quotation. Start new calculation first if a saved request is present. No persisted prices are hardcoded and no existing/cloud demo data was altered.

## Migration, deployment and limits

Migration 006 plus explicit runtime grants/function EXECUTE are required before releasing T04. New inventory: 17 tables, five functions, 30 enabled triggers. Existing migrations 001-005/checksums and historical snapshots remain intact. Runtime performs no migrations. Do not deploy T04 against an 001-005-only database: readiness intentionally fails. Apply/verify through the existing guarded maintenance flow only in the separately controlled cloud step; that step is not performed here. A code rollback can retain the additive schema/history; do not drop events.

Owner reports Render + Neon live; T04 itself is local-only and not deployed. No Neon access, migration, Render setting change, push/merge, password reset, PDF or rate management. Actual blockers: none for the defined local implementation. Separately controlled cloud migration/release remains required.

Known limits: shared synthetic demo read scope, process-local throttling, manual refresh between sessions, same-tab sessionStorage recovery, terminal rejection for a version, long UUID quotation numbers. SQL credentials/maintenance owners remain trusted; role checks in an SQL trigger do not authenticate an HTTP session. The immutable snapshot status column still records original draft assembly; use lifecycle endpoint/event history for current authorization/status. No notifications, PDFs, sequential invoice numbering or new architecture framework.

## Three owner-understanding questions

1. Why does exactly INR 25,00,000 clear automatically while INR 25,00,000.01 requires Sales Head, and which stored value decides this?
2. Why must approval/issuance lock the existing quotation header used by version allocation rather than only the event rows?
3. If issuance commits but its response is lost, why does retrying the original actor/key/body recover the same quotation number without another issued event?

STOP after the focused T04 commit.

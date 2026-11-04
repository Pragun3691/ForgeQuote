# T06 handoff - rate catalogue and essential intake UX

Branch: feature/T06-rate-management-ux from clean main 1f4f038, identical to fetched origin/main. Owner approved focused implementation/local tests/docs/commit without another planning round and reports T01-T05 merged/deployed with live approval -> issuance -> customer PDF manually tested. T06 performed no cloud verification or change.

## Features and security approach

Authenticated GET /api/rates?asOf=YYYY-MM-DD serves all six rate categories, key IDs/codes/units, exact decimal-string values, current applicability and all effective periods with version UUIDs/database creation timestamps. Optional date defaults to Asia/Kolkata today. The UI supports category/date filtering, expandable history, missing-rate states and refresh. Periods use the unchanged next-start-derived view: inclusive start, exclusive end, last open-ended. Supplier/source author is not in the existing schema; the UI explicitly says it is not recorded.

The existing strict runtime role has SELECT-only rate access, and the accepted two-role policy designates no master writer. Following the owner's conditional boundary, T06 implements the safe read-only portion. Both active roles may read. Authenticated POST/PUT/PATCH/DELETE on /api/rates and subpaths are explicitly denied server-side with RATE_WRITE_FORBIDDEN after existing Origin/CSRF checks. Anonymous requests receive 401. Runtime still cannot INSERT/UPDATE/DELETE/TRUNCATE rate masters, own them or perform DDL. No grant, privileged SQL function, maintenance connection or writer role is introduced. No fake Add/Save control exists.

Adding effective-dated versions remains an actual policy gap: approve the writer role and a validated authoring contract covering backdating/future starts, decimal-string precision before NUMERIC coercion, source/actor audit, idempotency and narrow grants. Direct trusted maintenance SQL can round excess precision to NUMERIC(18,6); T06 does not claim to add precision validation to that operator path. All app rate writes, including unsupported precision, are denied. Existing duplicate-start and append-only protections remain in force; derived periods cannot overlap under ADR-0003.

## RFQ improvements

- Compact Gemini/Excel review summaries show component identifiers, quantities and fields requiring review. Field-level status/raw/normalized text, source quotes/offsets and worksheet/cell/header references remain unchanged inside native collapsible evidence sections.
- Manual form summary shows components/quantities/missing fields, with keyboard-operable jump buttons focusing each part and Tab moving into its fields. Existing required inputs, validation and server category/ID checks remain.
- Exactly one real key with an applicable stored version for a category/date produces a visible candidate. Selects stay empty until the estimator explicitly chooses Use suggested keys for part N. Only empty unique categories are filled; ambiguous categories and existing selections are preserved. No AI material inference or fabricated rate/default.
- Apply common rate keys to all parts deliberately copies all six selected real IDs from part 1, with visible replacement wording. Applying suggestions/copying/changing any field clears final human review. Saving still requires the existing review checkbox.
- Missing categories and selected keys without an effective current-date rate show explicit errors/warnings. RFQ creation still allows a key whose useful rate may lie at another quotation pricing date; missing pricing-date rates continue to fail costing rather than default to zero.
- History links used during editing open a separate tab, preserving unsaved manual fields. Frozen/uncertain request bodies/keys remain exact and all selection actions are disabled while frozen/busy/storage-blocked.
- Responsive wrapping and keyboard details/buttons work at 320/390px. Optional exact-alias material suggestions are omitted because no approved alias registry exists.

## Files and endpoints

New: apps/api/src/rate-catalogue.js, apps/api/test/rate-catalogue.test.js, apps/web/src/RateCatalogue.jsx, tests/browser-rates-ux.smoke.js, docs/decisions/0016-rate-catalogue-intake-ux.md, tasks/T06-rate-management-ux.md and this handoff.

Changed: apps/api/src/app.js registers catalogue; errors.js adds a redacted catalogue-unavailable response. apps/web/src/Workspace.jsx adds catalogue navigation; RfqCreate.jsx uses catalogue availability metadata and explicit key/navigation actions; RfqExtraction.jsx/RfqDocumentImport.jsx add summaries/collapsible evidence; styles.css adds scoped responsive styles. API/root package.json register the tests. tests/browser-ai.smoke.js/browser-xlsx.smoke.js now assert collapsed defaults and explicitly open evidence for the same previous checks. README.md and status/requirements/deployment/learning docs record the contract, results and missing writer decision.

Existing /api/rfq-rate-keys, RFQ POST schemas/canonical hashes/storage, extraction/provider/parser code, quotation costing/snapshot/lifecycle/PDF services, migrations/grants/security inventory and financial goldens are unchanged. No dependency change or migration. GET catalogue returns {asOf,canWrite:false,rateKeys}; invalid date/unknown query 400, unauthenticated/inactive 401, role/write forbidden 403, redacted storage failure 503. Read operations do not need a new CSRF/idempotency contract; all existing writes retain theirs.

## Tests and evidence

All database runs used localhost-guarded, uniquely named disposable forgequote_t06_*_test parents. Suite fixtures/roles/schemas/databases and parent were cleaned up; no existing development/test DB or cloud data changed.

- npm.cmd test: 82/82 passed, including real evidence verification/parser, financial goldens and customer PDF checks.
- Complete test:db file list with rate-catalogue.test.js in a disposable parent: 128/128 passed. New coverage: both roles and six categories, date/next-start boundaries/future rates/no history, exact six-place strings/units/source IDs/time, duplicate starts, immutable history, runtime ownership/ACL denials, all HTTP write methods/subpaths/over-precision bodies denied, active-user/date/query/CSRF checks, and old saved quotation unchanged after a backdated rate append changes future resolution.
- npm.cmd run test:costing: 33/33 passed; all nine original golden cases and persisted multipart expectations unchanged.
- All nine Chrome suites passed: auth, quotation, manual RFQ, AI, Excel, numbered-part association, lifecycle, PDF and new rates/UX. Existing recovery/legacy multipart/approval/issue/PDF checks remain. AI regression calls use mocked providers but real unchanged server verification and PostgreSQL; no live Gemini call is claimed.
- Focused Chrome verifies both-role read-only catalogue, keyboard-opened history, as-of missing-rate view, empty/multiple/unique selection behavior, no preselection, explicit candidate action, common copying/replacement, human review reset, missing-history warning, keyboard focus/Tab, two-part actual save with exact persisted material/freight IDs and quantities, unsaved-field preservation in a new history tab, and no horizontal overflow at 320/390/1280px. Gemini/Excel tests preserve their source evidence assertions after expanding initially collapsed evidence.
- Syntax: 44 API source/maintenance modules and changed test scripts passed. Production Vite build and actual local production startup 1/1 passed. git diff --check passed. Desktop/mobile screenshots in ignored .tmp/t06-browser/ were inspected; existing extraction/import screenshots remain ignored.

Initial focused failures were a missing explicit accessible select label and a test reaching PostgreSQL's FK TRUNCATE restriction before its history trigger; fixed the label and used TRUNCATE ... CASCADE only in the disposable fixture to test the unchanged trigger. No unresolved required test failure.

## Migration/deployment and remaining issues

Migrations required: none. No schema/grants/function/inventory, dependency, environment variable, Render setting or cloud migration change. Existing 006 remains the application's readiness prerequisite. T06 is not pushed, merged or deployed. No Neon/Render access, reset, new AI provider, unrelated feature or C1 audit.

Remaining decision: authorized rate-version writer and validated maintenance workflow. Optional aliases remain omitted. Other limits: all catalogue history is loaded for this small two-role synthetic demo, source supplier/author is not recorded, current-date suggestions do not guarantee every historical pricing date, and existing browser recovery is same-tab sessionStorage. These are explicit boundaries, not a hidden financial fallback. No blocker remains for the defined safe local T06 slice.

## Three owner-understanding questions

1. Why can both demo roles inspect rate history while neither may add a version, and which policy/grants must be decided before authoring is implemented?
2. How do unique effective starts and derived exclusive next-start ends prevent overlapping periods without changing old quotation snapshots?
3. Why do single-key suggestions/common-key copying require an estimator action and reset final review, and why does today's key availability not guarantee a historical quotation rate?

STOP after the focused T06 commit.

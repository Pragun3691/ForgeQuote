# Terminal RFQ closure handoff

Verification status: complete locally; ready for owner review. No staging, commit, push, merge or deployment.

## Implementation and cause

The original code serialized quotation writes on their quotation header, while outcomes used a separate RFQ advisory lock. Neither quotation creation nor lifecycle services/triggers checked the outcome. An immutable Won/Lost event therefore did not freeze later versions. The original six-case red regression confirmed that saves still succeeded after closure.

New rule: after Won/Lost, no new quotation creation, submission, approval, rejection or issuance. API guards run after the shared quotation-header lock; allocation/version/event SQL triggers enforce the same rule. Outcome recording now takes that lock too. Actor/request locks, receipts, roles, CSRF and approved finance remain unchanged. Closure-first blocks writes; quotation-first finishes before closure. See ADR 0028 for the complete rationale.

An additional red regression reproduced a direct SQL bypass using an old REPEATABLE READ / SERIALIZABLE snapshot. All four write guards now fail closed at those isolation levels with SQLSTATE 25000. READ COMMITTED application writes retain their existing behavior; PostgreSQL READ UNCOMMITTED is equivalent and accepted. Plain BEGIN inherits the server default, so a release must verify the runtime connection's default isolation. Production defaults were not independently inspected here. No database setting was changed.

API terminal conflicts use `RFQ_TERMINAL` / HTTP 409. SQL terminal conflicts use 55000. Successful identical committed receipt lookup precedes terminal rejection. Changed intent conflicts; new or uncommitted requests cannot create work after closure. No automatic retry is introduced.

## UI and contracts

- Both roles receive a clear closed/read-only explanation. Costing inputs remain retained; new saves/calculations and lifecycle actions are unavailable. Existing saved financial results remain immutable.
- Closure confirmation explicitly warns about every blocked operation, unsupported reopening, other tabs and newer unfinished versions. It preserves cancellation and focus return.
- Closed RFQs leave the pending queue. Stale save/decision/issuance attempts receive server conflicts and refresh authoritative status without replacing independent action errors.
- Saved-request and lifecycle recovery remain enabled after closure. Confirmed closure clears inapplicable rejection/costing unload markers; unknown/failed lifecycle reads retain F1 protection. F2's sequence-guarded refresh remains.
- Additive read fields: RFQ `versions[].lifecycleStatus` and lifecycle `rfqOutcome`. Existing request bodies, keys and financial response strings are unchanged. No new endpoints.
- Customer PDFs still require the current issued version; historical INTERNAL PDFs retain existing eligibility. Renderers, snapshots and financial calculations are unchanged. Closed-state text does not instruct users to issue an ineligible version.

## Migration and historical compatibility

New forward-only migration: `apps/api/db/migrations/008_terminal_rfq_quotation_guards.sql`. Replaces three guard bodies and adds `guard_quotation_version()` / `quotation_version_terminal`. Readiness requires 008. Strict inventory: 18 tables, 8 functions, 35 enabled triggers. No new table, column, dependency, environment variable or broad permission grant.

001–007 are byte-identical to the checkpoint. No historical data migration or correction. A permanent synthetic test builds the original 001–007 schema, records Won on November 5, inserts/approves/issues Version 3 on November 9 through the original SQL contract, applies 008, and compares saved snapshots, histories, metadata and both PDF buffers before/after. It passes without rewriting either event. The real production RFQ was not queried or changed by this task.

## Verification evidence

Evidence is under ignored `.tmp/terminal-*.log` and `.tmp/terminal-rfq/`. Database launchers privately target a fresh local `*_test` database, and fixtures create/drop their own schemas/roles or dedicated browser databases. They do not target `forgequote_dev` or cloud databases. The ignored launcher is a local verification artifact; standard `npm run test:db` requires an explicitly guarded disposable test configuration.

| Gate | Actual command | Result |
| --- | --- | --- |
| Original defect reproduction | `node .tmp/t06-run.mjs --test --test-name-pattern="terminal RFQ closure" apps/api/test/final-workflows.test.js` | Before correction, six expected rejections were missing. The permanent tests now live in `terminal-rfq.test.js`; the original final-workflows test file is byte-identical to baseline. |
| Focused terminal API/SQL/concurrency/history | `node .tmp/t06-run.mjs --test apps/api/test/terminal-rfq.test.js` | Initial corrected gate 40/40; subsequently expanded into 60 tests included in the complete 197-test gate. |
| Stronger-isolation red/green | `node .tmp/t06-run.mjs --test --test-name-pattern="stale repeatable" apps/api/test/terminal-rfq.test.js` | Red reproduced invisible closure; final green 9/9. |
| Focused terminal browser | `node .tmp/t06-run.mjs tests/browser-terminal-rfq.smoke.js` | PASS, including real stale tabs and committed lifecycle replay. |
| Complete browser | `node .tmp/t06-run.mjs tests/run-browser-suites.js` | 22/22 on both the first complete pass and final frozen-artifact repeat; no failed/skipped suites. Existing 21 plus new terminal suite. |
| Frontend helpers | `node --test tests/rate-authoring.test.js tests/rate-view.test.js tests/intake-validation.test.js tests/intake-review.test.js tests/m1-state.test.js tests/register-view.test.js tests/ui-format.test.js tests/ui-evidence.test.js` | 24/24, no skips. |
| Unit | `npm.cmd test` | 90/90, no skips; final run includes explicit 008 readiness assertion. |
| Complete API/database | `node .tmp/t06-run.mjs .tmp/m5-m6-db.mjs` | Final 197/197, no skips (137 existing + 60 new). Includes actual 008 readiness and cloud privilege/inventory checks. |
| Financial | `npm.cmd run test:costing` | 33/33; all nine external golden cases unchanged. These tests also run within the unit suite. |
| Syntax | `npm.cmd run check:api` | 47/47 source/maintenance modules. |
| Production build | `npm.cmd run build` | PASS, 62 modules; final JS artifact `index-DqHjHQXk.js`, CSS `index-rUvFg2wQ.css`. |
| Actual production startup | `npm.cmd run test:production` | 1/1; real server serves React/liveness and correctly returns not-ready for its deliberately unreachable disposable-test connection. No production database connection. |
| Patch/preservation | `git diff --check`, checkpoint SHA-256 comparisons | PASS; 001–007 and financial engine/test/golden files unchanged. 19 protected migration/finance/auth/configuration files compared with no changes. |

Existing F1 coverage passes in M7; F2 and draft-protection coverage pass in M1. M2/M8 include real Chrome 200%/400% zoom, keyboard/focus, reduced motion and the existing contrast checks. Actual synthetic PDFs are downloaded/parsed by both the new suite and existing M7/M8 suites. Live Gemini remains untested in this assignment; provider-boundary browser tests use explicitly mocked responses.

Development test corrections were confined to new test fixtures (required login CSRF handshake and existing superseded customer-PDF ineligibility) and the mandated inventory expectation changing from seven to eight functions. No accepted assertion was weakened. Expected-red and failed-development logs remain ignored for review.

Permanent API coverage includes Won/Lost with draft/pending/approved newer versions, every blocked action, runtime SQL allocation/version/event attempts, both commit orders for API and SQL writes, stale stronger-isolation snapshots, all committed receipt types, changed/new requests, role/CSRF checks, approval exclusion, historical reads/PDF bytes and legacy migration compatibility.

Browser coverage includes both roles, closure preview/cancel/focus, stale save/approve/reject/issue sessions, retained inputs, draft-marker behavior, pending-queue exclusion, same-key save/lifecycle replay, actual historical PDF downloads and no page overflow at 1440×1000, 768×1024, 390×844 and 320×844. All 21 existing suites remain enabled; the new terminal suite is the 22nd.

## Screenshots and inspection

24 actual synthetic-data captures: `.tmp/terminal-rfq/closure-review-{width}.png`, `closed-overview-{width}.png`, `closed-estimator-{width}.png`, `closed-sales-{width}.png`, `closed-estimator-documents-{width}.png`, `closed-sales-documents-{width}.png`, for widths 1440/768/390/320. Four downloaded PDFs are in the same directory. Captures, PDFs, checkpoints and logs are ignored artifacts, not commit files.

Review samples: [desktop closure confirmation](../.tmp/terminal-rfq/closure-review-1440.png), [mobile closure confirmation](../.tmp/terminal-rfq/closure-review-320.png), [desktop closed overview](../.tmp/terminal-rfq/closed-overview-1440.png), [mobile closed overview](../.tmp/terminal-rfq/closed-overview-390.png), [mobile retained inputs](../.tmp/terminal-rfq/closed-estimator-320.png), [mobile Sales Head review](../.tmp/terminal-rfq/closed-sales-390.png), [tablet historical documents](../.tmp/terminal-rfq/closed-sales-documents-768.png).

Personally inspected desktop, tablet and mobile/narrow captures, including confirmation, closed banner, retained inputs, Sales Head lifecycle and both document controls. No page overflow in any of the four tested widths. Final browser output: `.tmp/terminal-browser-final.log`; final database output: `.tmp/terminal-db-final.log`; focused evidence: `.tmp/terminal-browser.log`, `.tmp/terminal-api.log`, `.tmp/terminal-http.log`, `.tmp/terminal-isolation-{red,green}.log`. The result JSON in `.tmp/terminal-rfq/results.json` records six Won/Lost × version-state journeys and four PDF downloads.

Desktop/mobile review corrected two misleading inherited instructions: changing inputs to create a version and issuing an approved version on an already closed RFQ. No visual system/CSS changes were needed.

## Limits and release considerations

- Local PostgreSQL and Chrome verification only. No independent production behavior, live provider call, cloud concurrency, Safari/Firefox, physical mobile device or assistive-technology session is claimed.
- The original IsoCode source wording remains unverified. This implementation follows the explicit owner terminal rule.
- Outcome preview is the last loaded metadata; confirmation warns about newer changes elsewhere. The database is authoritative and closes all unfinished versions.
- Existing unsupported reopening and same-tab draft lifetime remain. No new tenant/account behavior, email delivery or legal-document compliance is implied.
- No development database, production record, Neon/Render setting, public URL or credential was changed. All database-backed tests use guarded disposable databases/schemas.

Separately authorized deployment must quiesce older writers, verify/backup the intended target, apply pending 008 through the checksum runner, apply/check the existing narrow function permissions, then start the reviewed release and verify readiness/roles/terminal conflicts/recovery/PDFs. Readiness rejects a 007-only schema. See `deployment.md`.

## Rollback and preservation

Baseline HEAD: `bceb4f95f5b538de32e1bc3c91eb137235e9dffb`; branch `fix/terminal-rfq-closure`. `.tmp/terminal-before/manifest.json` records 268 exact pre-edit files and SHA-256 values, with status and both patches. No earlier work/checkpoint was discarded.

Before deployment, review the exact changed-file list below, save any later owner work separately, restore only this task's modified files from the checkpoint and remove only its newly added files. Do not use reset/clean/stash or blindly copy over newer edits. No development/production database rollback is needed because none was migrated here.

After a future deployment, keep 008 and its history/guards; prefer a forward compatible correction. An older API can surface generic errors on terminal writes. Disabling guards, deleting outcomes or reversing 008 would violate the accepted rule and requires separate approval. Do not rewrite the old Won event or newer quotation history.

## Exact changed files

31 intended files: 25 modified, 6 new, 0 deleted. All unstaged. The other 243 baseline files remain byte-identical. No secret-pattern findings, credential URLs, unexpected binaries or forbidden artifact paths in the changed-file scan; this is a local pattern review, not a claim of an external security audit. No changes to package-lock, authentication implementation, original migrations, financial engine/goldens, `.env.example` or Render configuration. No unexpected files or staged changes.

- `apps/api/package.json`
- `apps/api/src/app.js`
- `apps/api/src/cloud-database.js`
- `apps/api/src/errors.js`
- `apps/api/src/final-workflows.js`
- `apps/api/src/quotation-lifecycle.js`
- `apps/api/src/quotations.js`
- `apps/api/src/rfqs.js`
- `apps/api/test/app.test.js`
- `apps/api/test/cloud-database.test.js`
- `apps/api/test/database.test.js`
- `apps/api/test/quotations.test.js`
- `apps/web/src/CostingInputs.jsx`
- `apps/web/src/FinalWorkflows.jsx`
- `apps/web/src/PdfDownloads.jsx`
- `apps/web/src/QuoteLifecycle.jsx`
- `apps/web/src/QuoteResults.jsx`
- `apps/web/src/Workspace.jsx`
- `docs/architecture.md`
- `docs/current-status.md`
- `docs/decisions/0017-final-requirements.md`
- `docs/deployment.md`
- `docs/learning-log.md`
- `docs/requirements.md`
- `tests/run-browser-suites.js`
- `apps/api/db/migrations/008_terminal_rfq_quotation_guards.sql`
- `apps/api/test/terminal-rfq.test.js`
- `docs/decisions/0028-terminal-rfq-closure.md`
- `docs/terminal-rfq-closure-handoff.md`
- `tasks/terminal-rfq-closure.md`
- `tests/browser-terminal-rfq.smoke.js`

## Owner understanding checks

1. Why must identical committed receipt lookup occur before terminal rejection?
2. Which operation wins when closure and a quotation write race, and why do both SQL and API paths use the same lock?
3. Why can historical Version 3/PDFs remain unchanged while all future writes to that Won RFQ are blocked?

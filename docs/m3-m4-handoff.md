# M3 and M4 - register and costing workspace

Owner-approved sequential assignment on feature/forgequote-visual-v2, based on a9fb910. M1/M2 accepted and preserved. No commit, staging, push, merge, deployment or M5.

## M3 result

Register search (reference/customer), status/estimator filters, deterministic sort, explicit reset/refresh and truthful result counts use existing returned data. Separate approval search/reference/version ordering preserves server-supplied saved-version order by default. Native links in the leading column make RFQ/review entry reachable without horizontal hunting. RFQ statuses remain separate from version lifecycle states; queue amounts are saved annual ex-GST values.

Search replaces the current hash entry; select/reset actions create history. Back/Forward and auth-scoped list destinations retain filter context. Task-only focus/scroll effects ignore query changes. Successful RFQ creation links its actual receipt ID. M1 form/recovery owners remain in place, with no navigation POST or new persistence.

M3 files relative to .tmp/m3-m4-before:

- apps/web/src/RfqRegister.jsx (new)
- apps/web/src/register-view.js (new)
- apps/web/src/Workspace.jsx
- apps/web/src/QuoteLifecycle.jsx (pending queue only)
- apps/web/src/route.js
- apps/web/src/main.jsx (destination props; auth handlers unchanged)
- apps/web/src/AppShell.jsx (list destination links)
- apps/web/src/styles/workflows.css
- tests/register-view.test.js (new)
- tests/browser-m3.smoke.js (new)
- tests/run-browser-suites.js
- tasks/m3-m4-register-costing.md (new)
- docs/decisions/0023-register-approvals.md (new)
- docs/m3-m4-handoff.md (new)
- docs/current-status.md and docs/learning-log.md (checkpoint entries)

M3 gates passed on the compact-row build: 16/16 browser suites, focused browser pass, 12/12 focused units, financial 33/33 with nine unchanged goldens, build (50 modules) and production startup 1/1. Full runner exited 0. The separate M3-accepted-before-M4 checkpoint is recorded before M4 starts.

Screenshots: .tmp/m3/before and .tmp/m3/after at 1440x1000, 768x1024, 390x844 and 320x844. Actual desktop/register, mobile actions and Sales Head queue inspected. Visual review replaced overly tall double-line desktop actions with a single 44px reference link, retaining Open RFQ as the accessible name and the reference as its description. Initial focused test exposed unstable implicit select labels; explicit aria-labels now keep their names stable.

## M4 result

Implemented after the separate 236-file verified M3 checkpoint. CostingInputs is controlled presentation; RfqWorkspace retains every read, draft, recovery and submission owner. SavedVersionNav identifies the selected immutable version with truthful neutral/loading/error states. Working inputs, server-confirmed submitted inputs and unresolved recorded submissions have distinct labels. A confirmed-submission link uses the actual receipt version. No ordinary inputs are called saved before confirmation.

Annual comparison now precedes per-part breakdowns. All figures identify annual/per-unit and ex-GST/GST-component/inclusive scope. Mobile summaries read the same saved totals; the complete financial tables remain accessible. At 320px, full-width monetary rows prevent decimal-digit wrapping. Saved input/result views sort copied arrays by part number without mutating snapshots. Sales Head has mobile saved-input summaries and the full read-only table. Explicit section/part jumps preserve the hash and all drafts; twenty-part review works for both roles. Background reads do not focus those targets.

M4 files relative to .tmp/m3-accepted-before-m4:

- apps/web/src/CostingInputs.jsx (new)
- apps/web/src/SavedVersionNav.jsx (new)
- apps/web/src/Workspace.jsx
- apps/web/src/QuoteResults.jsx
- apps/web/src/SavedCostingInputs.jsx
- apps/web/src/styles/workflows.css
- apps/web/src/QuoteLifecycle.jsx (queue default-sort copy only: Oldest saved first accurately describes the existing API order)
- tests/browser-m4.smoke.js (new)
- tests/browser-quotation.smoke.js (additional per-unit/ex-GST heading assertion)
- tests/browser-ui.smoke.js (additional leading mobile-action geometry assertion)
- tests/browser-version-consistency.smoke.js (additional selected-context assertion)
- tests/run-browser-suites.js
- docs/decisions/0024-costing-workspace.md (new)
- docs/decisions/0023-register-approvals.md (ordering wording clarification)
- docs/m3-m4-handoff.md, docs/current-status.md and docs/learning-log.md (final handoff/checkpoint entries)

Focused M4 checks pass on the final application: unchanged saved values while editing, both historical versions, independent failed-snapshot read recovery, unchanged exact body/key through committed-response loss and navigation, one replayed receipt/no duplicate, Sales Head 1,000-unit saved inputs versus 180,000 RFQ quantity, twenty-part navigation/edit retention, ordered saved review and no read-only form inputs. The repeated-spindle twenty-part fixture checks the independently fixed annual value INR 60,37,000.00 (20 x the existing 1,000-unit spindle baseline INR 3,01,850.00). Existing nine financial goldens are untouched.

Final combined browser gate: 17/17 suites passed on the final build, including all extended original assertions and both new milestones. Runner exited 0. Both milestones are complete locally and await owner review.

## Safety, lifetime and rollback

No backend, schema, API contract, financial formula, package/dependency, authentication/authorization or provider policy changes. Database-backed tests use guarded disposable local databases; forgequote_dev is not modified or seeded. Ordinary draft lifetime remains authenticated-tab memory; submitted intent retains its existing sessionStorage protocol.

.tmp/m3-m4-before contains 229 exact tracked/nonignored untracked files with SHA-256 hashes, branch/HEAD/status and staged/unstaged binary patches. Generated dependencies, Git metadata and earlier ignored artifacts remain untouched. Do not reset to HEAD or restore earlier M1/M2 checkpoints.

Combined rollback: after checking for newer owner edits, restore only files changed by this assignment from .tmp/m3-m4-before, remove only this assignment's new files, then rebuild. Keep accepted M1/M2 and unrelated work. The separate .tmp/m3-accepted-before-m4 checkpoint will allow M4-only restoration while retaining verified M3. No database rollback is needed.

## Test commands and results

| Gate | Command | Result |
| --- | --- | --- |
| M3 focused units | node --test tests/register-view.test.js tests/m1-state.test.js tests/ui-format.test.js tests/ui-evidence.test.js | 12/12 passed; .tmp/m3-unit.log |
| M3 browser milestone | node .tmp/t06-run.mjs tests/run-browser-suites.js (runner then contained 16 suites) | 16/16 passed before M4; .tmp/m3-all-browser.log |
| M3 build/startup/finance | npm.cmd run build; npm.cmd run test:production; npm.cmd run test:costing | 50-module build; startup 1/1; costing 33/33; .tmp/m3-*.log |
| Final focused units | node --test tests/register-view.test.js tests/m1-state.test.js tests/ui-format.test.js tests/ui-evidence.test.js | 12/12 passed; .tmp/m4-unit.log |
| Existing unit/config/parser/PDF | npm.cmd test | 90/90 passed; .tmp/m4-api-unit.log |
| Financial regression | npm.cmd run test:costing | 33/33 passed, nine goldens unchanged; .tmp/m4-costing.log |
| Existing database/API regression | node .tmp/t06-run.mjs .tmp/m3-m4-db.mjs (executes npm.cmd run test:db inside its guarded parent) | 137/137 passed; .tmp/m4-database.log |
| API syntax | npm.cmd run check:api | 47 modules passed; .tmp/m4-syntax.log |
| M4 focused browser | node .tmp/t06-run.mjs tests/browser-m4.smoke.js | Passed; .tmp/m4-focused.log |
| Final browser regression | node .tmp/t06-run.mjs tests/run-browser-suites.js | 17/17 passed; .tmp/m4-all-browser.log |
| Final production build/startup | npm.cmd run build; npm.cmd run test:production | 52-module build and startup 1/1 passed; .tmp/m4-build.log and .tmp/m4-production.log |

The existing ignored local-only wrapper creates a disposable *_test parent and points all child database variables at it. Browser fixtures additionally create their own dedicated local databases. The database bridge runs the unchanged npm test:db script under the same guards. With a separately configured guarded local test environment, the tracked browser command is simply node tests/run-browser-suites.js. No test targets forgequote_dev. No live provider/cloud call is used.

All original financial expectations, authorization/CSRF denial, expiry, replay/response-loss, immutable snapshots, PDF eligibility/confidentiality, version races, modal cancellation/double-confirm, source evidence/consent and M1/M2 checks remain. Three original browser tests gain assertions; none lose existing assertions. One new label assertion was corrected to expect the existing uppercase table-heading presentation. A new Baseline pill initially collided with the old unique .results .badge selector; plain baseline text preserves that selector. Visual review caught narrow monetary wrapping and added a no-wrap geometry regression. A queue copy review replaced Submitted order with Oldest saved first to match actual saved-version ordering without inventing submission timestamps.

Screenshots use real Chrome/synthetic fixtures at 1440x1000, 768x1024, 390x844 and 320x844. Existing M2 gates also execute genuine Chrome 200%/400% host zoom, reduced motion, focus and contrast checks on the final application. No CSS/pinch zoom substitution. Curated screenshot links and manifest are below; full raw evidence remains in .tmp/m3 and .tmp/m4.

## Screenshot review

61 curated actual screenshots are in .tmp/m3-m4-review. [Screenshot manifest](../.tmp/m3-m4-review/screenshots.json) records viewport sizes/hashes and passing suite names. [Exact milestone/combined file manifests](../.tmp/m3-m4-review/changed-files.json) support the rollback boundaries.

| Milestone / surface | Before | After |
| --- | --- | --- |
| M3 register desktop | [1440](../.tmp/m3-m4-review/m3-before-register-1440.png) | [1440](../.tmp/m3-m4-review/m3-after-register-1440.png), [768](../.tmp/m3-m4-review/m3-after-register-768.png) |
| M3 register mobile | [390](../.tmp/m3-m4-review/m3-before-register-390.png) | [390](../.tmp/m3-m4-review/m3-after-register-390.png), [320](../.tmp/m3-m4-review/m3-after-register-320.png) |
| M3 approvals | [320](../.tmp/m3-m4-review/m3-before-approvals-320.png) | [1440](../.tmp/m3-m4-review/m3-after-approvals-1440.png), [320](../.tmp/m3-m4-review/m3-after-approvals-320.png) |
| M3 no matches/read failure | - | [No matches](../.tmp/m3-m4-review/m3-after-no-matches-390.png), [retained data/error](../.tmp/m3-m4-review/m3-after-refresh-error-390.png) |
| M4 selected-version context | [1440](../.tmp/m3-m4-review/m4-before-estimator-context-1440.png) | [1440](../.tmp/m3-m4-review/m4-after-estimator-context-1440.png), [768](../.tmp/m3-m4-review/m4-after-estimator-context-768.png) |
| M4 working inputs | [390](../.tmp/m3-m4-review/m4-before-working-inputs-390.png) | [390](../.tmp/m3-m4-review/m4-after-working-inputs-390.png), [320](../.tmp/m3-m4-review/m4-after-working-inputs-320.png) |
| M4 annual comparison | [320](../.tmp/m3-m4-review/m4-before-saved-comparison-320.png) | [1440](../.tmp/m3-m4-review/m4-after-saved-comparison-1440.png), [390](../.tmp/m3-m4-review/m4-after-saved-comparison-390.png), [320](../.tmp/m3-m4-review/m4-after-saved-comparison-320.png) |
| M4 provenance | [390](../.tmp/m3-m4-review/m4-before-provenance-390.png) | [390](../.tmp/m3-m4-review/m4-after-provenance-390.png) |
| M4 Sales Head saved inputs | [320](../.tmp/m3-m4-review/m4-before-sales-inputs-320.png) | [768](../.tmp/m3-m4-review/m4-after-sales-inputs-768.png), [320](../.tmp/m3-m4-review/m4-after-sales-inputs-320.png) |
| M4 twenty-part review | [768](../.tmp/m3-m4-review/m4-before-twenty-parts-768.png) | [Context](../.tmp/m3-m4-review/m4-after-twenty-parts-768.png), [Estimator jump](../.tmp/m3-m4-review/m4-after-twenty-part-inputs-390.png), [Sales Head jump](../.tmp/m3-m4-review/m4-after-twenty-sales-inputs-390.png) |
| M4 unknown outcome | - | [Locked same-request recovery](../.tmp/m3-m4-review/m4-after-uncertain-recovery-390.png) |
| Downstream regression | - | [Gemini evidence](../.tmp/m3-m4-review/downstream-gemini-evidence-390.png), [matrix](../.tmp/m3-m4-review/downstream-matrix-320.png), [authoring](../.tmp/m3-m4-review/downstream-rate-author-390.png), [issuance](../.tmp/m3-m4-review/downstream-issuance-320.png) |
 Personally inspected register/queue entry, both-role context, working fields, annual summaries, provenance, twenty-part navigation, read-only summaries, matrix and Gemini evidence. Final narrow monetary rows are intact; all three scenarios remain available through saved summaries/full tables. Wide comparison/history/matrix tables intentionally retain named keyboard scrolling.

## Limitations

- Search/filter/sort cover the already returned list; no server pagination or new tenant isolation.
- Ordinary unsent drafts retain M1's authenticated-tab memory lifetime. Forced unload/crash, sign-out or expiry can discard them; recorded requests retain existing sessionStorage recovery.
- Twenty-part pages remain long documents with explicit section/part jumps, complete tables and bounded jump rails. No virtualization, wizard or hidden second form model.
- Narrow layouts stack monetary rows to keep paise intact. Extremely long valid decimal strings may wrap within their region; no value is rounded or truncated.
- Executed browser evidence is installed Chrome on Windows, viewport emulation and native host zoom. No physical device, Safari/Firefox or complete screen-reader/WCAG certification claim.
- No M5 intake/undo/validation redesign, M6 provider changes or M7 terminal-action changes. Existing functionality remains tested.

## Exact rollback boundaries

Do not reset to HEAD or use older M1/M2 checkpoints. Before assignment: .tmp/m3-m4-before/manifest.json (229 files). Before M4: .tmp/m3-accepted-before-m4/manifest.json (236 files). Both include exact file bytes/hashes, Git status, HEAD and staged/unstaged patches. Earlier ignored artifacts and dependencies remain in place.

- Combined rollback: restore only this assignment's modified existing files from .tmp/m3-m4-before and remove only its new files listed in the combined manifest; rebuild.
- M4-only rollback: restore M4's modified files from .tmp/m3-accepted-before-m4 and remove only its four new files (CostingInputs.jsx, SavedVersionNav.jsx, browser-m4.smoke.js, ADR-0024); rebuild. This retains verified M3. The pre-M4 snapshot retains the earlier queue label wording.
- M3-only rollback is meaningful after removing dependent M4 changes, since M4 builds on M3. Do not independently restore shared Workspace/styles/runner files while leaving M4 imports in place.
- Review any newer owner edits before restoring. No database/API rollback, reset or migration is required. No rollback command has been executed.

Example single-file restoration, not executed:

```powershell
Copy-Item -LiteralPath '.tmp/m3-accepted-before-m4/apps/web/src/Workspace.jsx' -Destination 'apps/web/src/Workspace.jsx'
```

Deployment status: local uncommitted work only. No staging, commit, push, merge or deployment. Stop after both milestones; no M5.

## Three owner understanding questions

1. Why are list filters URL state while costing drafts and submitted exact-key requests have different storage/lifetime rules?
2. Which source supplies a historical version's annual totals, rates and Sales Head quantities when current RFQ facts or working margins differ?
3. Why can presentation sort a copied part array and relabel financial scope while never recalculating totals, reshaping a recorded request or inferring issuance eligibility?

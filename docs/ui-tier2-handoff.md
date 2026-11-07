# Tier 2 UI handoff - November 8, 2026

Final checkpoint: the owner approved Tier 1/Tier 2 and the version-consistency fix, and authorized the local redesign commit after fresh full regression and staging checks. All ten existing browser suites plus version-consistency/focused UI, 90 unit, 33 costing, 137 PostgreSQL/API, five display/evidence tests, build, startup and 47 syntax checks passed. The complete 41-file source/docs/test manifest was reviewed; local artifacts/private drafts are excluded. No push, merge or deployment is authorized. Earlier uncommitted/review-pending statements below are historical handoff checkpoints.

Implemented on the existing `feature/forgequote-ui-redesign` branch, in the owner's approved order. **STOP for owner review.** No commit, push, merge or deployment. Proportional cost-breakdown charts are deferred.

Subsequent review: owner approved Tier 2 visuals subject to a final version-label check. A genuine stale selector-list bug was reproduced and corrected; see [version consistency handoff](version-consistency-handoff.md) for the additional Workspace/test changes and consistent replacement captures. The original `saved-inputs-1440.png` mismatch is explained there; later regression captures at that path reflect the correction.

The owner accepted the Tier 1 visual refinement before authorizing Tier 2. Prior code changes, README and `.tmp/submission/` drafts are retained. A file-for-file copy of the accepted Tier 1 code/docs/test delta is in `.tmp/tier1-approved/manifest.txt` and its matching paths; this is a local checkpoint, not a Git commit. Current Tier 2 screenshots are under `.tmp/tier2/` and `.tmp/tier2/ui/`.

## Delivered interactions and data flow

### 1. Multi-part rate-key matrix

- One semantic table contains Material, Machine, Scrap, Overhead, Packaging and Freight selectors for every part. Single-part RFQs retain the original labelled controls.
- All selectors use the same `form.parts[].rateKeys`, category-filtered catalogue data and `partChange/change` handlers. There is no second assignment state, automatic key selection, changed payload or rate calculation. The matrix waits for catalogue data so loading is not misreported as missing keys.
- Explicit suggested keys and common copying from part 1 retain their original warnings/behavior. Every edit/apply/copy resets final estimator confirmation. Existing required fields and disabled/frozen states apply to the matrix.
- Desktop shows all six categories together at 1440px. Mobile uses the existing labelled horizontal-scroll region with a sticky part column. Full selected code/unit remains available in the select title/dropdown.
- Independent checks passed rates-UX, RFQ, AI, AI-association and XLSX suites before evidence implementation began. Added checks count 120 selectors for 20 parts, preserve surviving assignments after middle-part deletion, verify review reset and retain the existing exact save/replay tests.

### 2. Gemini source/evidence review

- Desktop places the exact submitted source alongside extracted field review. Mobile stacks these panes. Existing raw/normalized values, statuses, issues, quotes, component association and warnings remain available.
- Verified offset convention: the existing server uses JavaScript `indexOf`, string length and accumulated line lengths. Spans are zero-based UTF-16 code units with an exclusive end. The test calls the actual verifier with emoji, a variation selector, accented text and CRLF; an independently specified ten-code-unit prefix and every genuine returned quote match browser-compatible `slice`.
- Highlight only if `found` and `inScope` are true, bounds are valid integers and the original source slice exactly equals the evidence quote. No trim, newline normalization, fuzzy matching or replacement search occurs. Missing/unscoped/mismatched evidence stays visible without highlighting.
- A source-reference button focuses the source pane and locates the quote. Return to field restores its trigger. Source is rendered as React text, not HTML; highlighting denotes location, not factual approval.
- Visual QA exposed ancestor overflow clipping that prevented the source pane from sticking beside later fields. Intake containment now allows the pane to stick while tables keep their own scroll boundaries. Mobile source navigation reveals the pane below the sticky navigation; browser geometry assertions check that its heading and selected mark remain visible.
- Source/review/selection remain transient React state. Editing reviewed source clears stale review and resets both consent checkboxes. Existing Gemini disclosures, explicit Apply, manual key selection, final confirmation, cancellation and failure/manual fallback remain.
- Independent evidence unit tests and both AI browser suites passed before the Sales Head summary began. Expanded testing found an unstable wrapping textarea label after its value was populated; explicit `htmlFor/id` association retains the exact visible label and makes repeat editing accessible. The final mock-provider test deliberately re-extracts only after fresh consent; no production retry/provider rule changes.

### 3. Sales Head saved-costing summary

- Replaces disabled defaults with a semantic read-only table sourced solely from the selected saved snapshot: pricing date/version, routing revision/ID, margin, cycle/setup inputs and all three saved annual quantities.
- RFQ facts remain separate. Without a selected version, the summary asks for selection; loading does not substitute defaults. Saved results, rate provenance and the INTERNAL PDF remain available.
- The estimator form, its state, exact financial strings, request body and pending recovery are unchanged. No current catalogue/routing lookup or recomputation supplies historical values.
- Independent lifecycle, quotation and focused UI suites passed before issuance confirmation began. A historical test proves a saved 1,000-unit baseline appears while the RFQ's own quantity remains 180,000, and Sales Head POST is still denied server-side.

### 4. Issuance confirmation

- Existing eligible estimator action opens a native dialog showing RFQ/customer, exact saved version/pricing date and saved annual value excluding GST. It explains issuance/new-version semantics and server revalidation. No quotation number is invented.
- Opening, Cancel, Escape or navigation sends no issuance POST and allocates no recovery key. Cancel receives initial focus; Tab/Shift+Tab cycle within the two controls, Escape cancels, and cancellation restores trigger focus.
- Confirm calls the existing `act('issue')`; the same server rules, CSRF, authorization, version checks and request recovery remain. A synchronous in-flight guard prevents rapid duplicate confirmation events before React state updates.
- Uncertain-response recovery still uses the original saved key/body through the existing Retry action, without another new issuance confirmation/key. Known eligibility loss closes the dialog; changing version unmounts it.
- Independent lifecycle, PDF and focused UI suites passed. Expanded tests caught two issues and retained the failing assertions until fixed: busy state alone permitted two rapid requests; native last-button Tab could leave the expected button cycle. A ref guard and explicit focus wrapping fixed them. Cancellation/no-key, navigation, forward/reverse focus, one-POST double-click and lost-response/reload/same-key issuance recovery are verified.

## Exact Tier 2 file delta

These are changes relative to the accepted Tier 1 checkpoint; earlier uncommitted Tier 1 files remain in the branch/worktree.

Application:

- `apps/web/src/RfqCreate.jsx`
- `apps/web/src/RateKeyMatrix.jsx` (new)
- `apps/web/src/RfqExtraction.jsx`
- `apps/web/src/EvidenceSource.jsx` (new)
- `apps/web/src/evidence-display.js` (new)
- `apps/web/src/Workspace.jsx`
- `apps/web/src/SavedCostingInputs.jsx` (new)
- `apps/web/src/QuoteLifecycle.jsx`
- `apps/web/src/IssueConfirmation.jsx` (new)
- `apps/web/src/styles.css`

Tests:

- `tests/helpers/rate-key-controls.js` (new; locates the single native control in either the single-part group or multi-part row)
- `tests/ui-evidence.test.js` (new)
- `tests/browser-rfq.smoke.js`
- `tests/browser-rates-ux.smoke.js`
- `tests/browser-ai.smoke.js`
- `tests/browser-ai-association.smoke.js`
- `tests/browser-lifecycle.smoke.js`
- `tests/browser-ui.smoke.js`

Documentation:

- `tasks/ui-tier2.md` (new)
- `docs/decisions/0019-tier2-review-controls.md` (new)
- `docs/decisions/0018-drafting-sheet-ui.md` (owner acceptance/supersession note)
- `docs/current-status.md`
- `docs/learning-log.md`
- `docs/ui-tier2-handoff.md` (new)

Endpoints added/changed: none. Migrations: none. Dependencies/package/lockfile changes: none. Backend, money formulas, tax assumptions, snapshots, rate resolution, provider/schema/association, approvals, auth/CSRF and PDF services are unchanged. `git diff` for backend/package/README paths remains empty. Deployment: local build only; no cloud action.

## Complete regression verification

| Command | Result |
| --- | --- |
| `npm.cmd run build` | PASS; final production Vite bundle, 40 modules |
| `npm.cmd test` | 90/90 PASS |
| `npm.cmd run test:costing` | 33/33 PASS; all nine original financial goldens unchanged |
| `node --test tests/ui-format.test.js tests/ui-evidence.test.js` | 5/5 PASS (three display and two evidence tests) |
| `node .tmp/t06-run.mjs --test apps/api/test/database.test.js apps/api/test/auth.test.js apps/api/test/quotations.test.js apps/api/test/quotation-api.test.js apps/api/test/cloud-database.test.js apps/api/test/rfq-intake.test.js apps/api/test/ai-api.test.js apps/api/test/xlsx-api.test.js apps/api/test/lifecycle.test.js apps/api/test/quotation-pdf-api.test.js apps/api/test/rate-catalogue.test.js apps/api/test/final-workflows.test.js` | 137/137 PASS, including suite parents |
| `node .tmp/ui-browser-run.mjs` | All ten existing Chrome workflow suites PASS on the final build |
| `node .tmp/t06-run.mjs tests/browser-ui.smoke.js` | PASS; 21 current UI screenshots, role/focus/review/overflow/contrast checks |
| `npm.cmd run check:api` | 47 module syntax checks PASS |
| `npm.cmd run test:production` | 1/1 PASS; actual production startup/React/liveness |
| `git diff --check` | PASS |
| `git apply --reverse --check .tmp/tier2-only.patch` | PASS; validates the Tier 2 rollback patch without applying it |

Final logs use `.tmp/tier2-complete-{browser,ui,db,unit,display,costing,syntax,production}.log`. The browser runner executes all ten existing suites: auth, quotation, RFQ, AI, XLSX, AI-association, lifecycle, PDF, rates-UX and final-workflows. Each uses the existing local-only disposable-parent wrapper and real restricted PostgreSQL fixtures. The focused UI suite is additional. No existing development/test database was migrated, reset or regranted; generated parents/fixtures close in finally blocks. Provider browser calls are explicitly mocked, not live Gemini connectivity checks.

Golden tests overlap the unit suite; these counts are separate commands, not a sum of distinct cases. No financial, consent, authorization, immutable-history or recovery assertion was removed to make a presentation change pass. Locator updates follow the intentional matrix/source/summary structure, including scoping a quote assertion after the same quote also appeared in a highlight.

## Screenshots and accessibility review

The final UI suite captures login, register, intake, matrix, detail, approvals, Sales Head review, rates and expanded rate history at 1440px/390px, plus focused matrix and keyboard-scrolled register captures (21 images). Feature suites add evidence/source, historical summary, issuance and 20-part boundary screenshots.

Useful review pairs:

- Matrix: [desktop](../.tmp/tier2/ui/matrix-detail-1440.png), [mobile](../.tmp/tier2/ui/matrix-detail-390.png).
- Source/evidence: [desktop](../.tmp/tier2/evidence-source-1440.png), [mobile](../.tmp/tier2/evidence-source-390.png). Full review pages: `evidence-1440.png` / `evidence-390.png` in the same directory.
- Saved summary: [desktop](../.tmp/tier2/ui/sales-review-1440.png), [mobile](../.tmp/tier2/ui/sales-review-390.png). Historical 1,000-unit examples: `saved-inputs-1440.png` / `saved-inputs-390.png`.
- Issuance: [desktop](../.tmp/tier2/issuance-1440.png), [mobile](../.tmp/tier2/issuance-390.png).

Representative pairs were visually inspected: six matrix categories fit on desktop; mobile row context/scroll cues remain; exact source marks render without HTML interpretation; read-only inputs distinguish saved values from RFQ facts; dialog text/buttons fit both widths. Original Tier 1 first-pass screenshots remain under `.tmp/ui-review/`; current Tier 2 captures use their own directory. The accepted Tier 1 source checkpoint remains intact.

Soft-dark tokens and copper action semantics are unchanged. The focused token checks retain minimum text contrast 4.90:1 and dark-on-copper action contrast 6.07:1. Highlights use neutral raised/settled styling and explanatory text. Visible focus, native selects, required labels, status words and scroll-region names remain. Dialog keyboard tests cover initial focus, both wrap directions, Escape and return focus. Source navigation also has a return-to-field path. This is targeted Chrome accessibility verification, not a full WCAG/screen-reader audit.

## Local review, limits and rollback

Use existing local configuration/demo credentials. Run `npm.cmd run dev:api` and `npm.cmd run dev:web` in separate repository terminals; open the printed Vite URL (normally http://127.0.0.1:5173 with the configured API proxy/origin). Review at 1440x1000 and 390x844, 100% zoom. No migration/seed is needed for this UI review.

1. Estimator -> New RFQ -> Add part: inspect six keys per row, suggestions/common copying, missing-key warnings, Tab order and review reset. Use synthetic data only.
2. Open Gemini extraction, read the disclosure and attest both consents. In a successful synthetic extraction, open field evidence and select View source. Check the exact mark and Return to field. Edit source and verify both consents/results reset. Live provider availability is independent of these local mocked tests.
3. Sales Head -> select an existing saved version: review saved inputs, pricing date and quantities. Select a historical version to distinguish it from live RFQ facts.
4. Estimator -> an eligible approved saved version -> Issue quotation: review dialog/Cancel/Escape without writing. Confirm issuance only on a deliberate synthetic workflow; it persists a real issued event. The existing server still determines eligibility.

Known limits: Windows Chrome is tested; Firefox, Safari and a full screen-reader audit are not. Mobile screenshots are emulated widths. Matrix selections can truncate long codes visually; native dropdown/title exposes the full value. Wide mobile tables intentionally scroll. Evidence review only highlights exact server-located spans; unsupported/ambiguous facts remain manual even if a quote can be located. Provider connectivity/quality is not established by mock tests. Decisions made in another session still require the existing explicit refresh; the server rechecks issuance after confirmation. With no selected saved version, there is intentionally no saved input summary data.

All code is uncommitted. A combined review patch is saved as `.tmp/tier2-review.patch`, and a Tier 2-only patch relative to the accepted local checkpoint is `.tmp/tier2-only.patch`. Before rollback, retain those artifacts and check for later owner edits. Restore only reviewed files from the accepted checkpoint and remove only newly introduced Tier 2 paths; do not reset/clean the whole worktree. Preserve README, submission drafts and prior Tier 1 changes. No database/deployment rollback is required.

## Owner understanding questions

1. Why are the verifier offsets UTF-16 positions, and what prevents an incorrect or repeated quote from being highlighted speculatively?
2. How does the matrix preserve all six assignments and review/reset/recovery behavior without maintaining a second copy of the form?
3. Why do Cancel and an uncertain issuance retry have different key behavior, and which layer ultimately decides whether the saved version can be issued?

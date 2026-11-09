# Final M1-M8 audit resolution - 2026-11-09

Owner scope: fix F1 only; defer F2 as a known, non-blocking limitation. No backend, schema, API, financial, security, dependency or deployment changes.

## F1: rejection-draft unload protection

The previous marker required `state.status === 'pending'`. Returning from Rates remounts the version-bound lifecycle component with a retained rejection reason but an initially unknown lifecycle response. The marker consequently cleared before the read completed, and stayed clear after a failed read. The reason survived, but browser unload protection did not.

The marker now conservatively protects a nonempty Sales Head rejection reason while lifecycle state is unknown, as well as while the confirmed version remains pending and not superseded. Loading, failed reads and delayed responses do not establish that a draft is inapplicable. A confirmed non-pending or superseded state clears the marker. Clearing the textarea explicitly discards the reason and clears protection; confirmed submission clears both the reason and marker. An empty reason does not warn. Reasons remain keyed by immutable version in the existing authenticated memory store. Existing durable same-key request recovery continues to take precedence over the ordinary draft marker.

The regression failed against the previous build at the delayed unknown-state assertion (`false !== true`), then passed after the correction. It covers an initially empty draft, navigation away, delayed return read, failed read, successful refresh with the exact reason retained, explicit clearing, empty remount, confirmed rejection, confirmed supersession while a reason is retained, independent version identity and confirmed approval with a working alternative rejection reason. Existing approval/rejection confirmation, keyboard focus, issuance, PDFs and outcome checks remain in the same M7 suite.

## F2: owner-deferred limitation

An obsolete post-save RFQ metadata refresh error may appear after a newer successful refresh. The saved quotation and financial results remain correct. The unconditional error handler on the older save-triggered refresh is unchanged in `Workspace.jsx`; this correction does not claim to fix or retest that race in production. Evidence is the preceding local disposable-browser audit reproduction, not independent production verification.

## Verification

Logs are retained locally under `.tmp/final-f1-*.log`. Database-backed verification uses guarded disposable local test databases, never `forgequote_dev`.

| Command | Result |
| --- | --- |
| `node .tmp/t06-run.mjs tests/browser-m7.smoke.js` | Pre-fix regression failed at the exact unknown-state defect; corrected focused suite passed, including an independent final rerun with supersession/version assertions; exit 0. |
| `node .tmp/t06-run.mjs tests/run-browser-suites.js` | All 21 suites passed; exit 0. |
| `node --test tests/rate-authoring.test.js tests/rate-view.test.js tests/intake-validation.test.js tests/intake-review.test.js tests/m1-state.test.js tests/register-view.test.js tests/ui-format.test.js tests/ui-evidence.test.js` | 24 passed; zero failures/skips. |
| `npm.cmd test` | Full rerun: 90 passed; zero failures/skips. Initial concurrent run: 89 passed, one existing Excel worker deadline timeout; rerun passed without code/test/timeout changes. |
| `npm.cmd run test:costing` | 33 passed; all nine financial golden cases unchanged. |
| `node .tmp/t06-run.mjs .tmp/m5-m6-db.mjs` | 137 API/database/security tests passed; process exit 0. |
| `npm.cmd run check:api` | 47 modules passed syntax checks. |
| `npm.cmd run build` | Passed; 62 modules. |
| `npm.cmd run test:production` | Actual production-mode startup test passed 1/1, serving built React/liveness. The test deliberately uses an unavailable database; this is not a production database readiness claim. |

The `.tmp` database wrappers are existing local guarded launchers, not newly added production tooling. Browser tests use actual local APIs/PostgreSQL and synthetic fixtures; lifecycle read fault injection reproduces the failure without fabricating a successful write. Existing suites exercise both roles, four widths, keyboard/focus, contrast/reduced motion and Chrome zoom. Chrome/local coverage does not establish Safari, Firefox, physical mobile, live Gemini or deployed production behavior. Ordinary unsent drafts retain their accepted authenticated-tab memory lifetime.

F1 failure-state captures are under `.tmp/m7/rejection-read-failure-{1440,768,390,320}.png`; desktop capture was visually inspected for real lifecycle error/retry presentation. The 390px viewport capture was also inspected but shows adjacent retained content rather than the lifecycle panel, so it is not claimed as a mobile error-panel visual check. This correction changes no layout or styles.

Integrity check `.tmp/final-f1-integrity.json` confirms exactly six existing files changed and one handoff added against the new checkpoint, all 87 backend files unchanged against pre-M7, F2's entire `Workspace.jsx` unchanged, and HEAD/index unchanged.

## Exact assignment files

- `apps/web/src/QuoteLifecycle.jsx`: F1 marker condition and explanatory comment only.
- `tests/browser-m7.smoke.js`: F1 regression and confirmed-state/version assertions; existing suite retained.
- `docs/current-status.md`, `docs/learning-log.md`, `docs/decisions/0027-rates-decisions-documents.md`, `docs/m7-m8-handoff.md`: audit resolution references.
- `docs/final-audit-resolution.md`: this handoff.

No endpoint or migration changes. No financial golden changes. No staging, commits, pushes, merges or deployment.

## Review verdict

**READY TO COMMIT WITH DOCUMENTED LIMITATIONS**, subject to owner review. F1 is corrected and regression-verified. F2 is deliberately unchanged and non-blocking by explicit owner decision. This verdict authorizes no Git write, deployment or production-readiness claim. Stop for owner review.

## Checkpoint and rollback

Before editing, `.tmp/final-f1-before` captured all 265 tracked/nonignored untracked files, exact SHA-256 hashes, branch/HEAD, working-tree/index patches and status. Existing ignored checkpoints were left in place. The branch remains `feature/forgequote-visual-v2` at `a9fb9106a1dbe6cdf634bfdebe38bb69cad5e6c8`.

For owner-authorized rollback, first preserve any later edits in another checkpoint. Restore only the six pre-existing assignment files listed above from their matching paths in `.tmp/final-f1-before`; remove this newly added handoff only after preserving it. Do not reset/clean/stash or apply the complete baseline patch: all accepted M1-M8 work is already in the checkpoint. Rebuild the frontend and rerun the focused suite; the pre-fix regression is expected to fail. No database rollback applies.

## Owner review questions

1. Why does a failed lifecycle read provide no evidence that a retained rejection reason is inapplicable?
2. How does durable same-key recovery differ from an ordinary unsent rejection draft?
3. Why can the deferred F2 message be obsolete while the saved snapshot and financial results remain valid?

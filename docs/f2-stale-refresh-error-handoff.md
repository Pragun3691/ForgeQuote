# F2 stale refresh-error correction

Owner-approved separate bug fix on `fix/f2-stale-refresh-error`, based on accepted M1-M8/F1 commit `69c3e5c28657a169c9c665af4f30439f5e8ad13d`. F2 was previously deferred as non-blocking at final audit; that historical decision remains in `final-audit-resolution.md`. This subsequent assignment corrects it locally. No commit, push, merge or deployment is authorized/performed by this assignment.

## Root cause and exact correction

`apps/web/src/Workspace.jsx:152` previously attached an unconditional catch to the save-triggered `readRfq()`. The central reader already guarded RFQ data and `readError` by request sequence and abort state, but rethrew failures. An older failure could therefore escape that guard and write a stale refresh message into the separate action `error`. Newer successful reads cleared only `readError`, leaving the obsolete action error visible even after another successful refresh.

The application change is one line: replace that outer catch with `refreshRfq()`. The existing helper clears the old read error on deliberate refresh, calls the same sequence-guarded reader and consumes the rejected promise. A genuine latest failure remains visible through the reader's `readError`; a latest success clears that error. No new request, cancellation policy, state owner or automatic POST retry is introduced. Both existing post-save metadata requests remain.

The reader's data guard already prevented older metadata from replacing newer RFQ data. Investigation reproduced error presentation corruption without changing saved snapshots or financial results. Initial RFQ loading, selected-version snapshot/metadata validation, manual/lifecycle/outcome refreshes, independent action/storage/snapshot errors, latest-read session expiry, form memory and exact-request recovery remain under their existing owners. No general action error is cleared by metadata success.

## Permanent regression evidence

`tests/browser-m1.smoke.js` retains all ten original cases and assertions and adds three cases to the existing suite, keeping the browser runner at 21 suites:

- `f2-stale-refresh`: a real save starts an older held metadata request; the newer snapshot-related request succeeds; the older request then fails with 503. Both metadata requests must remain, and no obsolete error may appear. A latest failure remains visible after an older success; successful latest retry clears it. A newer real metadata assignment survives an older success. Saved quotation JSON is unchanged; golden unit price INR 149.70, manufacturing cost INR 119.76 and annual ex-GST baseline INR 26,946,000.00 are unchanged. There is exactly one save POST, unchanged serialized recovery intent and no unhandled promise rejections. Actual expiry of disposable fixture sessions still invokes sign-in and restores the saved record without replaying the POST.
- `f2-unmount-save`: a delayed older save refresh returns 401 after leaving for the register. The abandoned request must not trigger stale session recovery. Back navigation restores the same saved request. A further delayed 503 while visiting Rates cannot damage the retained unsaved margin or its unload marker. Exactly one save POST occurs in this case.
- `f2-action-error`: a failed save remains visibly failed after successful metadata refresh. Its uncertain original request stays intact and the same-request retry remains available; no false success is shown.

The existing `read-error-scope` case still verifies that metadata success does not clear an independent saved-snapshot failure and that explicit snapshot retry recovers it. The existing quotation/auth/version-consistency suites additionally cover exact-key uncertain recovery, authorization, history and selected immutable snapshots.

Before changing application code, the permanent regression failed with `F2: an older save-triggered failure must not overwrite a newer successful refresh` (`1 !== 0`). After the one-line fix, the independent focused suite passed all 13 cases. Test-harness development corrected one route interception lifetime and attached the promise-rejection observer to existing hash documents as well as future documents; no product assertion or timeout was weakened.

The first complete run passed through M6, then failed M7's existing final rate-discard immediate zero-count assertion. The unchanged M7 suite failed there again independently. An ignored diagnostic copy observed the validation summary still present immediately after the click and removed 38 ms later when the unchanged `resetCycle` effect completed; all original assertions then passed. The only additional file beyond the planned list is `tests/browser-m7.smoke.js`: add a bounded Playwright wait for that region to detach before its original zero-count assertion. No assertion is removed/relaxed, no timeout is increased, and no rate-authoring/F1 application behavior changes. A complete 21-suite rerun follows this deterministic test synchronization; both failed logs remain available.

## Verification

| Check | Actual result |
| --- | --- |
| Pre-fix permanent regression | Failed at the exact stale-error assertion, exit 1. |
| Focused M1/F2 browser suite | 13/13 cases passed, exit 0. |
| Independent synchronized M7 suite | Passed with every original assertion retained, exit 0. |
| Complete browser runner | All 21 suites passed on the complete rerun, exit 0. Initial run stopped at the existing M7 discard-timing assertion; see the diagnostic and synchronization explanation above. |
| Frontend helpers | 24 passed, zero failures/skips. |
| Existing units | 90 passed, zero failures/skips. |
| API/database/security | 137 passed, zero failures/skips; process exit 0. |
| Financial | 33 passed; all nine golden cases unchanged. |
| API syntax | 47 modules passed. |
| Frontend production build | Passed; 62 modules. |
| Actual production startup | 1/1 passed; built React and liveness served. The test deliberately uses an unavailable database; this is not a production database-readiness claim. |

Commands (from repository root; `.tmp` wrappers are existing ignored local guarded launchers):

```powershell
$env:M1_CASE='f2-stale-refresh'
$env:M1_STAGE='f2-before'
node .tmp/t06-run.mjs tests/browser-m1.smoke.js # Pre-fix red run only
Remove-Item Env:M1_CASE
$env:M1_STAGE='f2-after'
node .tmp/t06-run.mjs tests/browser-m1.smoke.js
Remove-Item Env:M1_STAGE
node .tmp/t06-run.mjs tests/run-browser-suites.js
node --test tests/rate-authoring.test.js tests/rate-view.test.js tests/intake-validation.test.js tests/intake-review.test.js tests/m1-state.test.js tests/register-view.test.js tests/ui-format.test.js tests/ui-evidence.test.js
npm.cmd test
node .tmp/t06-run.mjs .tmp/m5-m6-db.mjs
npm.cmd run test:costing
npm.cmd run check:api
npm.cmd run build
npm.cmd run test:production
```

The red run precedes the application correction and rebuild; it is expected to pass rather than reproduce the defect on the corrected build. No reset/reseed of `forgequote_dev`: all writable verification uses guarded disposable local databases and synthetic fixtures. Session expiry/metadata updates described above affect only their disposable fixture.

Local logs: `.tmp/f2-red.log`, `.tmp/f2-focused.log`, `.tmp/f2-browser-all.log` (initial failure), `.tmp/f2-browser-all-rerun.log` (complete rerun), `.tmp/f2-m7-rerun.log` (independent original assertion failure), `.tmp/f2-m7-diagnostic.log`, `.tmp/f2-m7-synchronized.log`, `.tmp/f2-frontend.log`, `.tmp/f2-unit.log`, `.tmp/f2-api.log`, `.tmp/f2-financial.log`, `.tmp/f2-syntax.log`, `.tmp/f2-build.log`, `.tmp/f2-startup.log`. Focused case results: `.tmp/m1/f2-after/results.json`. Actual pre-fix capture `.tmp/m1/f2-before/f2-stale-refresh-failure.png` and corrected capture `.tmp/m1/f2-after/f2-recovered.png` were visually inspected: obsolete error before; coherent selected version, confirmed-save notice and golden financial values without that error after. These are ignored local evidence, not production captures.

`.tmp/f2-integrity.json` verifies the application change is exactly the approved line replacement, all original M1 assertions remain, and the only M7 change is the bounded wait before its unchanged assertion. All other 259 pre-existing checkpoint files, including all 87 backend files, financial goldens and the F1 application correction, remain byte-identical. HEAD and the empty Git index are unchanged.

## Exact changed files

- `apps/web/src/Workspace.jsx`: the one-line refresh correction.
- `tests/browser-m1.smoke.js`: permanent controlled-response regression coverage only; original assertions unchanged.
- `tests/browser-m7.smoke.js`: wait for the existing asynchronous validation reset before the unchanged final discard assertion; required by the full verification gate, as explained above.
- `docs/current-status.md`: current correction/verification status above historical milestones.
- `docs/learning-log.md`: caller-catch ownership lesson.
- `docs/decisions/0021-m1-navigation-drafts.md`: clarification of existing read-error ownership.
- `docs/final-audit-resolution.md`: subsequent-correction notice retaining historical F2 deferral.
- `docs/f2-stale-refresh-error-handoff.md`: this handoff.

## Limits and rollback

F2 is implemented and locally verified, ready for owner review. The complete requested verification passed; no unresolved F2 defect was found in the covered cases. The historical deferral is superseded by this separate correction, not erased. No staging, commit, push, merge or deployment has been performed.

This is local Chrome verification. Safari/Firefox, physical devices, screen-reader user testing, live Gemini and deployed production behavior are not newly verified. Existing ordinary drafts retain authenticated-tab memory lifetime. A genuine latest refresh failure still requires explicit retry; independent saved-snapshot failures retain their own recovery action. No new unresolved F2 limitation is known from the verified cases; no claim is made that every possible asynchronous workflow race was exhaustively tested.

All application changes are frontend-only. No backend/schema/API contract, financial formula, golden, security, authorization or dependency change. Accepted M1-M8 and the F1 correction remain intact. No staging, commit, push, merge, deployment, reset, clean, stash or history rewrite.

Before investigation/implementation, `.tmp/f2-before` captured all 266 tracked/nonignored files, exact SHA-256 hashes, branch/HEAD, status and index/working patches. Existing ignored checkpoints remain untouched. For an owner-authorized rollback, first preserve any subsequent edits in another checkpoint. Restore only the seven pre-existing assignment files listed above from matching `.tmp/f2-before` paths; preserve/archive the new handoff separately. Rebuild and rerun the focused regression, which should reproduce F2 again on the old implementation. Do not reset/clean/stash or rewrite the accepted branch; no database rollback is needed.

Owner understanding questions: Why does the reader rethrowing a stale failure make the caller's unconditional catch unsafe? Why must successful metadata refresh leave action/snapshot errors intact? Why can the correction safely consume a rejected promise without hiding the latest read failure?

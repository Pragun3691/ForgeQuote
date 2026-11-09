# M1 - navigation, draft protection and state reliability

November 9, 2026. Branch `feature/forgequote-visual-v2`, HEAD remains `a9fb910`. Owner-authorized M1 only; prior redesign/audit work preserved. No M2, commit, push, merge or deployment.

## Root causes and solutions

| Issue | Root cause | M1 solution |
| --- | --- | --- |
| Unsaved costing reverted after rates/navigation | RfqWorkspace unmounted and rebuilt the form from pending storage/defaults | Auth-scoped memory store retains exact inputs by RFQ. Fresh metadata does not reset a remembered form. Valid locked submitted intent takes precedence; initialization waits for recovery inspection. |
| Intake details/parts disappeared | Creating was parent local state, but its form subtree unmounted on detail/rates navigation | Explicit intake route plus one retained hidden intake subtree preserves fields, parts, source/file and review state. No new persistence. |
| RFQs did nothing at `#`; history/active state diverged | Intake had no history entry; shell/raw-hash and workspace/parsed-hash logic differed | One parser shared by shell/workspace; `#view=intake`; RFQs exits it; Back/Forward restore task/draft; existing URLs/names retained. |
| Old lifecycle error survived HTTP 200 | Reads and actions shared an error, and refresh success only set data | Separate resource read errors and write/storage/download errors. Clear only the appropriate read error on retry/success. Other-resource and unresolved-action errors remain. |
| Manual fallback notice invisible | Notice lived inside the disclosure being closed | Parent status notice outside the panel; focus RFQ reference after busy state clears; repeat callbacks also refocus. |
| Dependent refresh erased authoring or showed stale lists | Catalogue cleared its entire data subtree; register/queue reads were not invalidated by relevant navigation/actions | Retained rates/authoring with explicit refreshing/stale labels; fresh register/approval reads on return; known-action callbacks refresh dependent metadata; abort/sequence guards reject late reads. |

No financial calculation, decimal formatting, API transport contract, selected-version authority, role check, provider policy, consent or exact-request replay rule changed. Login/logout/expiry handlers, API helper, pricing/output formatting, source-slice verifier, issuance confirmation and stylesheet match the pre-M1 checkpoint.

## Exact M1 changed files

These are M1 deltas relative to `.tmp/m1-before/`, **not** the complete Git diff, which also contains the owner's earlier uncommitted visual work.

| File | Change |
| --- | --- |
| `apps/web/src/route.js` (new) | Shared hash parser/subscription/navigation contract |
| `apps/web/src/draft-store.js` (new) | Auth-lifetime memory Map and unsent-dirty markers |
| `apps/web/src/WorkspaceDrafts.jsx` (new) | React scope/hooks and browser unload warning |
| `apps/web/src/read-error.js` (new) | Read-only transport/503 feedback with actionable domain errors retained |
| `apps/web/src/main.jsx` | Same route source for navigation and keyed auth-lifetime workspace; role-correct intake rates target |
| `apps/web/src/Workspace.jsx` | Intake history/retention; costing memory; separate read errors; initialization/unmount guards; dependent refresh callbacks |
| `apps/web/src/QuoteLifecycle.jsx` | Abort-safe read state, independent operation errors, dependency notification, stable rejection label |
| `apps/web/src/RateCatalogue.jsx` | Retained data/authoring, active-view reads, accurate refresh/error feedback and aborted-read guard |
| `apps/web/src/RfqCreate.jsx` | Parent manual fallback/focus; unsent markers; retains existing submitted-intent storage |
| `apps/web/src/RfqExtraction.jsx` | Parent fallback callback; transient source unload marker without new persistence |
| `apps/web/src/RfqDocumentImport.jsx` | Parent fallback callback; selected-file unload marker without new persistence |
| `apps/web/src/FinalWorkflows.jsx` | Authoring dirty state/reset after known save, remembered unsent outcome reason, stable reason labels |
| `tests/browser-m1.smoke.js` (new) | Confirmed-failure and additional state/recovery browser regressions, before/after screenshots |
| `tests/m1-state.test.js` (new) | Route contract, exact-string memory/auth isolation, dirty markers, read-error messages |
| `tests/run-browser-suites.js` (new) | Tracked sequential runner for all 13 existing suites plus M1 |
| `tests/browser-rfq.smoke.js` | Remove redundant New RFQ click after reload; recovery now opens directly in intake |
| `tests/browser-xlsx.smoke.js` | Same entry-step adjustment; original validation/replay assertions preserved |
| `docs/decisions/0021-m1-navigation-drafts.md` (new) | Navigation, transient draft and read-state decisions |
| `tasks/m1-navigation-state.md` (new) | Approved scope/plan and stop boundary |
| `docs/current-status.md`, `docs/learning-log.md` | M1 checkpoint and lessons |
| `docs/m1-handoff.md` (new) | This handoff |

Backend, migrations, database grants, package manifests/lockfile, financial fixtures and visual tokens/styles have no M1 changes. Existing `styles.css`/main/test/documentation visual-v2 Git changes are retained, not rolled back.

## Regression evidence

Seven cases failed against the pre-M1 production bundle before verification: costing draft, intake draft, same-hash navigation, lifecycle read recovery, manual fallback, authoring refresh and dependent register. The corrected pre-M1 evidence is `.tmp/m1/before/results.json`; preliminary harness evidence is retained separately. The failures used fixed independent expectations such as margin `17.25`, reference `SYNTH-M1-UNSAVED`, zero remaining read alerts, unchanged stored request bytes and the existing `₹149.70` saved spindle baseline.

The final M1 suite additionally verifies delayed old rate responses cannot replace the new date/read or erase authoring, ordinary drafts are isolated across auth lifetimes, and an RFQ metadata success does not clear a separate saved-quotation read failure. These make **10 focused browser cases**. Navigation/retention send no quotation POST and do not alter sessionStorage. Source remains in transient memory; repeated fallback notices stay visible and move focus correctly.

Two original recovery suites initially assumed reload returned to the register. Their entry steps now follow the approved explicit intake route; exact key/body replay, disabled frozen inputs, one saved RFQ and validation assertions remain intact. The original visual suite also caught a role-switch new-tab regression; the rates target is now Estimator-intake-only and the focused identity case locks that behavior down. A test-harness route-release race was corrected; its one orphan disposable fixture and NOLOGIN role were identified and cleaned up, leaving development data untouched.

## Commands and results

Final gates passed. Logs are ignored/local in `.tmp/m1/`.

| Gate | Command | Result |
| --- | --- | --- |
| Focused/unit display/evidence | `node --test tests/m1-state.test.js tests/ui-format.test.js tests/ui-evidence.test.js` | 9/9 passed (`unit.log`) |
| Existing API unit/config/parser/PDF | `npm.cmd test` | 90/90 passed (`api-unit.log`) |
| Financial regression | `npm.cmd run test:costing` | 33/33 passed; all nine goldens unchanged (`costing.log`) |
| Existing 13 browser suites + M1 | `node .tmp/t06-run.mjs tests/run-browser-suites.js` | 14/14 suites passed; M1 10/10 cases (`all-browser.log`, `after/results.json`) |
| Frontend production build | `npm.cmd run build` | Passed; 44 modules; no dependency change |
| Actual production startup | `npm.cmd run test:production` | 1/1 passed (`production.log`) |

The existing local-only `.tmp/t06-run.mjs` wrapper supplies an isolated *_test parent. Browser fixtures create their own dedicated databases and cleanup afterward. The tracked runner also works directly with properly configured local test environment variables: `node tests/run-browser-suites.js`. It does not provision targets or run against production. No dev database reset/migration/seed, cloud request or live Gemini call was performed for M1.

Responsive/keyboard evidence covers 1440x1000, 768x1024 and 390x844 in the M1 cases, plus existing 320px/desktop/mobile suites. RFQs activates by Enter; Back/Forward are exercised; manual fallback focus is asserted; the existing issuance focus/cancellation/double-confirm tests and evidence-return tests remain. Existing contrast/reduced-motion checks are included in the full run. No page overflow was found in the focused captures.

## Before/after review

Curated review captures are in `.tmp/m1/review/`; complete raw before/after cases are in `.tmp/m1/before/` and `after/`. Before failure screenshots can be full-page; final M1 screenshots use the three viewport sizes above. Screenshots are actual Chrome/synthetic-fixture captures, not mockups.

| Behavior | Before | After |
| --- | --- | --- |
| Costing margin/input retention | [1440](../.tmp/m1/review/before-costing-return-1440.png) | [1440](../.tmp/m1/review/after-costing-return-1440.png), [390](../.tmp/m1/review/after-costing-return-390.png) |
| Intake reference/parts retention | [1440](../.tmp/m1/review/before-intake-return-1440.png) | [1440](../.tmp/m1/review/after-intake-return-1440.png), [390](../.tmp/m1/review/after-intake-return-390.png) |
| Lifecycle error after successful GET | [1440](../.tmp/m1/review/before-lifecycle-recovered-1440.png) | [1440](../.tmp/m1/review/after-lifecycle-recovered-1440.png), [390](../.tmp/m1/review/after-lifecycle-recovered-390.png) |
| Manual fallback notice/focus | [Failure](../.tmp/m1/review/before-manual-fallback-failure.png) | [390](../.tmp/m1/review/after-manual-fallback-390.png) |
| Authoring retained through refresh/navigation | [Failure](../.tmp/m1/review/before-authoring-refresh-failure.png) | [1440](../.tmp/m1/review/after-authoring-preserved-1440.png), [768](../.tmp/m1/review/after-authoring-preserved-768.png) |

## Limitations and lifetime rules

- Ordinary unsent drafts live in the current authenticated tab's memory, not durable storage. Internal navigation is protected. Refresh/closing may warn, but proceeding with unload, browser crash, sign-out or session expiry discards ordinary memory. Submitted exact-key recovery remains durable in its existing sessionStorage and is separate from this cache.
- New-tab rates access during intake remains intentional; that new tab has its own ordinary memory scope. No tenant-wide or cross-tab draft synchronization was introduced.
- Existing stale data is labeled during refresh/failure. Server eligibility, validation, role checks and rate resolution remain authoritative; the frontend does not infer a successful mutation from a refresh.
- Device verification is installed Chrome on Windows with viewport emulation. Physical mobile, Safari/Firefox and a complete screen-reader audit were not performed. M2 typography/layout/accessibility redesign is not included.
- No provider success or production/cloud behavior is claimed. No new persistent draft storage means no new storage-failure fallback; existing submitted-request storage failures remain visible and block writes.
- Unknown hash fallback, register mobile action layout, form validation redesign, part undo, richer decision previews and terminal-outcome confirmation remain later milestones from the audit.

## Rollback

Do **not** reset to HEAD/a9fb910: that would discard earlier uncommitted visual-v2 work. Before M1, all existing frontend and browser files plus status/learning docs were copied to `.tmp/m1-before/`, with a SHA-256 manifest.

For an M1-only rollback after reviewing any newer owner edits:

1. Restore the eight modified existing frontend files and two modified existing browser tests listed above from the corresponding `.tmp/m1-before/<path>` files.
2. Restore `docs/current-status.md` and `docs/learning-log.md` from that checkpoint if their only later changes are M1 entries.
3. Remove only the four new M1 frontend modules, three new test/runner files, M1 task, ADR-0021 and this handoff. Keep earlier audit/visual-v2 files and all unrelated work.
4. Rebuild the frontend and refresh/restart as appropriate. No database rollback or migration is required. Keep ignored before/after evidence if useful.

Example of a single-file restore, not executed:

```powershell
Copy-Item -LiteralPath '.tmp\m1-before\apps\web\src\Workspace.jsx' -Destination 'apps\web\src\Workspace.jsx'
```

Deployment status: local uncommitted frontend changes only. No staging, commit, push, merge or deployment. Stop after M1 for owner review.

## Three owner understanding questions

1. Why must a recorded uncertain request override an ordinary remembered form when the same RFQ is reopened?
2. Why does a successful RFQ metadata refresh leave a separate failed saved-quotation read or unresolved lifecycle action error intact?
3. Which drafts survive internal navigation, which survive reload, and why are raw source/file contents absent from durable storage?

# M2 - design system consolidation and application shell

November 9, 2026. Owner-approved M2 on `feature/forgequote-visual-v2`, HEAD `a9fb910`. M1 is accepted and preserved. No M3, commit, push, merge or deployment.

## Result

The existing charcoal/forest/ivory/crimson identity now has one token/control system and organized feature styles. Login/branding/shell presentation is separate from authentication orchestration. Desktop navigation, readable mobile identity, native controls, focus, skip navigation, task titles and scroll offsets share a consistent contract. There is no new workflow, dependency, external font or asset service.

All final gates passed. M2 is complete locally and awaits owner review. The complete existing thirteen-suite browser set, M1 and M2 pass on the final bundle.

## Exact M2 changed files

These are deltas against `.tmp/m2-before/`, not the full Git diff, which includes accepted uncommitted M1 and earlier visual work.

| File | M2 change |
| --- | --- |
| `apps/web/src/main.jsx` | Compose LoginView/AppShell; authentication state and handlers remain here |
| `apps/web/src/Brand.jsx` (new) | Original mark, navigation icons and manufacturing drawing extracted unchanged |
| `apps/web/src/LoginView.jsx` (new) | Controlled presentation; associated password help/error, login skip target and title |
| `apps/web/src/AppShell.jsx` (new) | Stable workspace position; same links/roles; skip, task title/focus and measured sticky-header offset |
| `apps/web/src/ui.jsx` (new) | Native ActionButton variants, Field label/hint structure and Notice presentation |
| `apps/web/src/styles.css` | Ordered stylesheet imports replacing the accumulated override file |
| `apps/web/src/styles/tokens.css` (new) | Approved colors plus supporting semantic/hover/focus, typography, spacing, shape and motion tokens |
| `apps/web/src/styles/base.css` (new) | Shared typography, controls, feedback, table foundations, keyboard focus and reduced motion |
| `apps/web/src/styles/workflows.css` (new) | Consolidated retained feature layouts, explicit variants, normalized spacing and readable metadata |
| `apps/web/src/styles/shell.css` (new) | Desktop sidebar, wrapping tablet/mobile navigation, skip link and obstruction offsets |
| `apps/web/src/styles/login.css` (new) | Editorial split; shorter small/short-screen composition; polished existing login states |
| `apps/web/src/FinalWorkflows.jsx` | Only the rate-authoring presentation class changes from `lifecycle` to `rate-author` |
| `tests/browser-ui.smoke.js` | Update the exact desktop sidebar-width expectation from 208 to 224px; all workflow assertions retained |
| `tests/browser-m2.smoke.js` (new) | Auth states, both roles, skip/title/focus, background refresh, unmount/resize race, contrast, responsive/downstream captures and native zoom |
| `tests/run-browser-suites.js` | Add M2 after the existing thirteen suites and M1 |
| `docs/decisions/0022-design-system-shell.md` (new) | Design-system, presentation and accessibility decisions |
| `tasks/m2-design-system-shell.md` (new) | Approved scope, checkpoint and verification contract |
| `docs/current-status.md` | M2 checkpoint and verification |
| `docs/learning-log.md` | Consolidation, stable state ownership and zoom/focus lessons |
| `docs/m2-handoff.md` (new) | This handoff |

No API endpoint, migration, schema, backend, financial fixture, package manifest/lockfile or PDF renderer changes. No database rollback is required.

## Design and architecture

The stylesheet entry imports tokens, base, workflows, shell and login in that order. The old CSS is removed rather than covered by a new override layer. Shared controls have one source; feature styles retain necessary structural variants. The accepted CSS had 715 rules, 1,701 declarations and 196 repeated selector/context occurrences. The consolidated system has 497 rules, 1,340 declarations and zero repeated selector/context occurrences across its five stylesheets. This counts organized source rules, not minified lines. The old teal alias is removed. Wider-to-narrower responsive groups are consolidated. Spacing follows 4/8/12/16/20/24/32/40px equivalents; radii use shared tokens. Feature layout CSS remains explicit and readable rather than introducing a styling framework.

The root is user-relative at 100%, with the existing local Segoe UI/system fonts. Shared body text is 15px, labels/table bodies 13px and essential metadata at least 12px by default. Financial values retain tabular numerals and their existing exact decimal-string formatting. The four approved brand colors remain unchanged; crimson is branding, not the default action/status. Interactive boundaries are stronger than structural separators. Written labels accompany status colors.

`App` owns credentials/session/auth calls. Its login/logout/expiry handlers are byte-identical to the checkpoint. The Workspace remains keyed only by authenticated user/role in one stable AppShell child position. Route navigation never keys/remounts the shell or workspace. Accepted retained intake/rates trees, ordinary draft cache, dirty markers, selected-version guards, submitted request bodies/keys, consent and recovery modules remain unchanged.

The shared primitives are small presentation components. Existing feature forms keep native controls and their state owners. Rate authoring has a distinct class so lifecycle floats/action layout cannot affect it. No large component migration or all-purpose form/request abstraction was introduced.

## Login and shell behavior

- Original split composition and local SVGs remain. Mobile introduction spacing is shorter and the form appears sooner; loading, native required validation, wrong-password/submitting, expiry and session-reload paths retain their behavior and names.
- Desktop sidebar is 224px and scrolls independently on short desktop heights. At 1050px and below, navigation becomes a compact wrapping header. At short viewport heights it scrolls normally, preserving usable space under high zoom. At 320px the Sales Head links may wrap; none are hidden in an inaccessible overflow area.
- Full signed-in heading names remain available to assistive technology; visible username/role replaces repeated account wording. Sign out and every existing navigation action remain real controls.
- Skip to main content is first in keyboard order on login and in the workspace. Its activation prevents hash navigation and creates no history entry.
- Deliberate task changes update title and focus a visible task heading or the content region while loading. Initial auth mount, saved-version-only changes and background refresh do not invoke this focus effect. Existing evidence return/modal behavior remains owned by those components.
- One measured `--shell-offset` replaces competing sticky-header scroll constants. Targets use that offset; the evidence pane's sticky top also accounts for it.

The first complete run found a genuine M2 resize/unmount race: a queued window resize could call getComputedStyle on a cleared React ref during sign-out. A MutationObserver-triggered regression reproduced the error deterministically (`.tmp/m2/auth-unmount-red.log`). The measurement callback now captures its elements and checks they remain connected. This does not alter sign-out/session behavior.

A later rendered-contrast pass caught a transient login-button ratio of 1.65:1 while busy/disabled foreground and background colors interpolated. Button fill/text now change atomically; the border retains its short transition. Real request-driven animation-frame sampling covers the transition, rather than waiting for it to finish. Final evidence checks 35 palette pairs and 1,368 rendered text samples across 52 screen/viewport states. The final full-run button probe sampled 290 frames with minimum contrast 6.11:1; frame counts vary with timing. Red evidence: `.tmp/m2/contrast-transition-red.log`; final frame evidence: `after/button-transition-contrast.json`.

## Verification

Final gates passed on the final build. Logs are local/ignored. The complete runner and focused M2 process both exited 0.

| Gate | Command | Result/log |
| --- | --- | --- |
| Focused state/display/evidence | `node --test tests/m1-state.test.js tests/ui-format.test.js tests/ui-evidence.test.js` | 9/9 passed; `.tmp/m2-unit.log` |
| Existing unit/config/parser/PDF | `npm.cmd test` | 90/90 passed; `.tmp/m2-api-unit.log` |
| Financial regression | `npm.cmd run test:costing` | 33/33 passed; all nine goldens unchanged; `.tmp/m2-costing.log` |
| Complete browser regression | `node .tmp/t06-run.mjs tests/run-browser-suites.js` | 15/15 suites passed (13 existing + M1 + M2); M1 10/10 cases; `.tmp/m2-all-browser.log` |
| Focused M2 | `node .tmp/t06-run.mjs tests/browser-m2.smoke.js` | Passed, including both-role native 200%/400% zoom, keyboard and unmount race; `.tmp/m2-focused.log` |
| Frontend production build | `npm.cmd run build` | Passed; 48 modules; final artifacts in `apps/web/dist/` |
| Actual production startup | `npm.cmd run test:production` | 1/1 passed; `.tmp/m2-production.log` |

The ignored existing local-only wrapper provisions an isolated *_test parent; browser fixtures create/clean their dedicated databases. The tracked runner works directly as `node tests/run-browser-suites.js` with the existing guarded local test environment. No development database migration, reset, seed, credential change, live provider request or production operation was performed. The only provider responses are explicitly mocked in tests.

M2 covers actual login loading/submitting/error/reload; both role shells; source consent/review; matrix selects; costing; rate authoring; issuance cancellation; route title/active/skip behavior; background refresh keeping authoring focus/values; an auth-unmount/resize regression; computed visible text colors and text-size checks; existing token contrast and reduced motion. Existing thirteen suites and M1 retain exact-key recovery, auth expiry/role denial, immutable versions, golden values, provider/import fallback, evidence focus and issuance modal/duplicate-confirm assertions.

Standard captures use 1440x1000, 768x1024, 390x844 and 320x844. Additional breakpoint assertions cover 1051/1050/1049, 1024, 901/900/899, 601/600 and 360/359px. Intentional financial/history/matrix table overflow is contained; page-level overflow is checked.

Native 200% and 400% Chrome host zoom uses fresh task-owned profiles and an actual 1440x1000 browser window. The test asserts devicePixelRatio 2/4 and exercises login, skip/navigation, costing inputs, modal actions and Sales Head authoring using keyboard focus. This is not CSS zoom, pinch or merely a small viewport. CDP captures the true zoomed viewport without Playwright's CSS-coordinate screenshot clipping. Chrome's content viewport excludes its browser frame/scrollbar, so zoom captures have different pixel dimensions from the standard exact-size viewport shots.

## Actual screenshot review

Before captures use the accepted pre-M2 production bundle; after captures use M2. Both use synthetic local fixtures. Full-page and detail images supplement viewport captures. Curated review images contain no browser profiles, environment files or credentials.

| Surface | Before | After |
| --- | --- | --- |
| Login | [1440](../.tmp/m2/review/before-login-1440.png), [390](../.tmp/m2/review/before-login-390.png) | [1440](../.tmp/m2/review/after-login-1440.png), [768](../.tmp/m2/review/after-login-768.png), [390](../.tmp/m2/review/after-login-390.png), [320](../.tmp/m2/review/after-login-320.png) |
| Estimator shell/register | [390](../.tmp/m2/review/before-estimator-register-390.png) | [1440](../.tmp/m2/review/after-estimator-register-1440.png), [390](../.tmp/m2/review/after-estimator-register-390.png) |
| Sales Head shell | [320](../.tmp/m2/review/before-sales-register-empty-approvals-320.png) | [320](../.tmp/m2/review/after-sales-register-empty-approvals-320.png) |
| Costing | [768](../.tmp/m2/review/before-costing-768-full.png) | [768 inputs](../.tmp/m2/review/after-costing-inputs-768.png), [390 inputs](../.tmp/m2/review/after-costing-inputs-390.png) |
| Multi-part matrix | [390](../.tmp/m2/review/before-matrix-390.png) | [1440](../.tmp/m2/review/after-matrix-1440.png), [320](../.tmp/m2/review/after-matrix-320.png) |
| Exact-source evidence | [390](../.tmp/m2/review/before-gemini-evidence-390.png) | [768](../.tmp/m2/review/after-gemini-evidence-768.png), [390](../.tmp/m2/review/after-gemini-evidence-390.png) |
| Rate authoring | [390](../.tmp/m2/review/before-rate-author-390.png) | [390](../.tmp/m2/review/after-rate-author-390.png) |
| Issuance | [320](../.tmp/m2/review/before-issuance-320.png) | [320](../.tmp/m2/review/after-issuance-320.png) |
| Native zoom | — | [200%](../.tmp/m2/review/after-zoom-200.png), [400%](../.tmp/m2/review/after-zoom-400.png), [400% costing](../.tmp/m2/review/after-costing-zoom-400.png), [400% issuance](../.tmp/m2/review/after-issuance-zoom-400.png), [400% authoring](../.tmp/m2/review/after-authoring-zoom-400.png) |

Reviewed actual before/after login and both-role shells, desktop/tablet costing, narrow matrix, exact-source evidence, authoring and issuance, including native 400% focus. The 390px login full-page height decreased from 944px to 884px. Essential table/header text is readable; selected navigation has a visible edge and border; native source/table scrolling and dialog actions remain reachable. At 320px Sales Head navigation wraps to keep labels and targets readable. The matrix remains intentionally wide, and register entry still needs the M3 operational-list refinement. Raw evidence: `.tmp/m2/before/`, `.tmp/m2/after/`; rendered contrast samples: `after/rendered-contrast.json`; palette checks: `after/contrast.json`.

## Limitations

- Ordinary unsaved draft lifetime remains M1's authenticated-tab memory contract. Internal navigation preserves it; forced unload/crash, sign-out and expiry can discard it. Submitted exact-key sessionStorage recovery remains separate and unchanged.
- Register mobile task-entry layout, richer filters, workbench/intake workflow restructuring, inline validation redesign and other M3+ audit work are deliberately not included. Wide tables continue to scroll in their named keyboard regions.
- Chrome on Windows provides the executed device/zoom evidence. Physical devices, Safari/Firefox, assistive-technology announcements and a full screen-reader/WCAG certification audit were not performed. Contrast sampling does not claim every possible future content/state combination.
- The shell can focus the content region before an asynchronously loaded RFQ title exists; it does not refocus when that read completes. This avoids delayed focus theft.
- No live Gemini/provider/production behavior is claimed. No tenant feature or backend isolation was added.

## M2-only rollback

Do not reset to HEAD or restore `.tmp/m1-before/`: either would discard accepted work. Before M2, `.tmp/m2-before/` captured 216 exact files with hashes, HEAD/branch/status and both Git patches. No reset/clean/stash/discard occurred.

After reviewing any newer owner changes:

1. Restore only these seven existing files from corresponding `.tmp/m2-before/<path>` copies: `apps/web/src/main.jsx`, `apps/web/src/FinalWorkflows.jsx`, `apps/web/src/styles.css`, `tests/browser-ui.smoke.js`, `tests/run-browser-suites.js`, `docs/current-status.md`, `docs/learning-log.md`.
2. Remove only M2's thirteen new files listed above: four presentation components, five files under `apps/web/src/styles/`, the M2 browser suite, task, ADR and this handoff. Do not remove M1 helpers/tests/docs or earlier visual/audit files.
3. Rebuild the frontend and refresh/restart as appropriate. There is no database or API rollback. Keep ignored review evidence if useful.

Example single-file restore, not executed:

```powershell
Copy-Item -LiteralPath '.tmp\m2-before\apps\web\src\main.jsx' -Destination 'apps\web\src\main.jsx'
```

Deployment status: local uncommitted frontend work only. Nothing staged, committed, pushed, merged or deployed. Stop after M2 for owner review.

## Three owner understanding questions

1. Why does moving presentation into AppShell preserve drafts only if the Workspace type/key/position remains stable across navigation?
2. Why does the shell focus on deliberate task changes but avoid refocusing when metadata or a saved version finishes loading?
3. Why are structural separators, control boundaries, status labels and crimson branding different semantic tokens even when they share a dark canvas?

# ForgeQuote visual v2 - owner review

November 8, 2026. Complete frontend presentation redesign on `feature/forgequote-visual-v2`, based exactly on `a9fb9106a1dbe6cdf634bfdebe38bb69cad5e6c8`. Visual acceptance is pending. No commit, push, merge, cloud operation or deployment.

## What changed

The full application uses a charcoal canvas, forest structural surfaces, ivory typography/actions and restrained crimson branding. Login has an original split composition, a folded-tool mark and technical line drawing. The workspace has icon-assisted navigation, clear active links, role identity, stronger page headings and compact tables. Detail, costing inputs, immutable baselines, scenario comparisons, intake/review, effective-dated rates and issuance share the same typography, spacing, borders and feedback language.

The existing stateful components remain responsible for their workflows. The redesign does not add a second form/review model or reimplement financial rendering. The 100% column receives visual emphasis from its existing position in the three-scenario tables. Every amount still comes from the same saved decimal strings. Error/success/pending labels retain their semantic meaning; crimson is a brand color.

MedReach was inspected read-only for responsive auth composition, validation/feedback and transition patterns. No MedReach file was modified or copied. All SVG graphics are original and local. No new package or font request.

## Changed files

| File | Change |
| --- | --- |
| `apps/web/src/main.jsx` | Login composition, original SVG mark/drawing/icons, password help association; same session/login/logout/expiry handlers |
| `apps/web/src/styles.css` | Shared palette/control tokens, focus/semantic states, all workflow presentation and responsive/reduced-motion rules |
| `tests/browser-ui.smoke.js` | Retains every assertion; captures viewport and full-page images in a separate v2 folder with exact requested viewport sizes |
| `tests/browser-lifecycle.smoke.js` | Retains existing lifecycle/finance/focus/recovery assertions; adds mobile overflow check and 1440x1000 / 390x844 issuance/saved-input captures |
| `tests/browser-visual-v2.smoke.js` | Real-auth loading, validation, busy, error, reload, keyboard, reduced-motion, both-role and import/evidence/matrix/rate captures; 35 contrast pairs |
| `docs/decisions/0020-visual-v2.md` | Supersedes the old palette while preserving behavioral decisions |
| `tasks/visual-v2.md` | Expanded owner-approved scope and stop boundary |
| `docs/current-status.md`, `docs/learning-log.md` | Current checkpoint and engineering lessons |
| `docs/visual-v2-handoff.md` | This review handoff |

Endpoints and migrations: none added or changed. `apps/api`, package manifests/lockfile, financial fixtures and PDF renderers have no changes. Authentication/session/CSRF, server authorization, immutable snapshots, idempotency, consent/disclosures, exact source verification and version consistency remain authoritative.

## Verification

Final gates passed. Logs remain local in `.tmp/visual-v2/`.

| Gate | Result |
| --- | --- |
| Unit/config/parser/PDF regression | 90/90 passed (`unit.log`) |
| Financial regression | 33/33 passed; all nine independent golden values unchanged (`costing.log`) |
| Disposable local PostgreSQL/API regression | 137/137 passed (`database.log`) |
| Display/evidence unit checks | 5/5 passed (`display.log`) |
| Existing ten browser workflow suites | 10/10 passed; runner exited 0 (`browser.log`) |
| Focused UI | Passed (`ui.log`) |
| Selected-version consistency | Passed (`version-consistency.log`) |
| New focused visual/auth suite | Passed, including final capture rerun (`visual.log`) |
| Frontend production build | Passed; Vite transformed 40 modules |
| Actual production startup | 1/1 passed (`production.log`) |

Commands: `npm.cmd run build`, `npm.cmd test`, `npm.cmd run test:costing`, `node --test tests/ui-format.test.js tests/ui-evidence.test.js`, `npm.cmd run test:production`. Browser suites and DB tests use the existing ignored `.tmp/t06-run.mjs` local-only parent-database wrapper; browser fixtures create their own dedicated disposable databases. Run `node .tmp/t06-run.mjs tests/browser-visual-v2.smoke.js` for the new visual checks. The wrapper refuses a non-local maintenance host. No existing application DB was migrated, seeded, reset or used for test writes.

The ten workflow suites are auth, quotation, RFQ, AI, Excel, AI association, lifecycle, PDF, rates UX and final workflows. Additional UI, selected-version and visual suites bring the browser total to thirteen. Gemini provider responses are mocked in test fixtures; actual authentication/API/PostgreSQL and browser rendering are real. No live AI request is claimed.

The first sandboxed build could not resolve Vite's configuration because esbuild's directory access was denied. Running the same build with approved normal filesystem access passed; no configuration workaround or dependency change was introduced.

## Screenshots

There are **96 actual Chrome screenshots** in `.tmp/visual-v2/`: 39 UI, 51 state/review and six lifecycle captures. Viewports are **1440 x 1000** and **390 x 844**. `-viewport` images show exactly the visible screen. Other UI images are full-page renders at that width; the two matrix-detail images are element crops. The review folder has both viewport and `-full` images; tall pages intentionally extend beyond the viewport. Wide financial/data tables scroll inside labeled keyboard-focusable regions.

| Screen | Desktop | Mobile |
| --- | --- | --- |
| Login | [1440](../.tmp/visual-v2/ui/login-1440-viewport.png) | [390](../.tmp/visual-v2/ui/login-390-viewport.png) |
| Login error | [1440](../.tmp/visual-v2/review/login-error-1440.png) | [390](../.tmp/visual-v2/review/login-error-390.png) |
| Estimator register | [1440](../.tmp/visual-v2/ui/register-1440-viewport.png) | [390](../.tmp/visual-v2/ui/register-390-viewport.png) |
| Pending approvals | [1440](../.tmp/visual-v2/ui/approvals-1440-viewport.png) | [390](../.tmp/visual-v2/ui/approvals-390-viewport.png) |
| RFQ/costing/results | [Full desktop](../.tmp/visual-v2/ui/detail-1440.png) | [Full mobile](../.tmp/visual-v2/ui/detail-390.png) |
| Manual intake | [Full desktop](../.tmp/visual-v2/ui/intake-1440.png) | [Full mobile](../.tmp/visual-v2/ui/intake-390.png) |
| Multi-part intake | [Full desktop](../.tmp/visual-v2/review/manual-multipart-1440-full.png) | [Full mobile](../.tmp/visual-v2/review/manual-multipart-390-full.png) |
| Rate-key matrix | [1440](../.tmp/visual-v2/review/matrix-1440.png) | [390](../.tmp/visual-v2/review/matrix-390.png) |
| Excel cell review | [Full desktop](../.tmp/visual-v2/review/excel-review-1440-full.png) | [Full mobile](../.tmp/visual-v2/review/excel-review-390-full.png) |
| Gemini source highlight | [1440](../.tmp/visual-v2/review/gemini-evidence-1440.png) | [390](../.tmp/visual-v2/review/gemini-evidence-390.png) |
| Sales Head saved inputs | [Full desktop](../.tmp/visual-v2/ui/sales-review-1440.png) | [Full mobile](../.tmp/visual-v2/ui/sales-review-390.png) |
| Rate catalogue/history | [Full desktop](../.tmp/visual-v2/ui/rate-history-1440.png) | [Full mobile](../.tmp/visual-v2/ui/rate-history-390.png) |
| Rate authoring | [1440](../.tmp/visual-v2/review/rate-author-1440.png) | [390](../.tmp/visual-v2/review/rate-author-390.png) |
| Issuance confirmation | [1440](../.tmp/visual-v2/lifecycle/issuance-1440.png) | [390](../.tmp/visual-v2/lifecycle/issuance-390.png) |

Additional captures include session loading, submitting, session failure/reload, empty pending approvals, scrolled register, filled matrix, complete Gemini review and the low-volume saved-input fixture. Screenshots are synthetic and local/ignored; they are not included in source control.

## Accessibility and visual review

The focused test checks 35 contrast pairs. Primary text is 12.90:1 or greater across canvas/panel/raised/forest; secondary text is 7.91:1 or greater; tertiary text is 6.11:1 or greater. Ivory action text/background contrast is 16.89:1; ivory on the crimson mark is 7.22:1. Input boundary contrast is at least 3.82:1; the 3px focus indicator is at least 10.38:1. Accessible error/pending/selected-state combinations are tested separately. Decorative drafting guides and structural hairlines are not relied upon to identify controls.

Keyboard verification covers login role/password/action order and empty-password prevention, navigation, horizontal scrolling, evidence source/return focus, modal Cancel initial focus, Tab/Shift+Tab wrap, Escape and focus return. Reduced-motion preference disables transitions. Existing browser checks verify mobile page overflow separately from intentional table scrolling.

Visual inspection included desktop/mobile login and errors, register/approvals, complete costing/results, intake, source highlight, rates/authoring and the issuance modal. The mobile modal buttons were corrected to match DOM/tab order during visual QA. Factual demo notices, Gemini terms/consent, immutable-value labels and manual fallback remain visible.

## Known limitations and review boundary

- Verified in installed Chrome on Windows, including emulated 390px mobile; physical iOS/Android, Safari/Firefox and a full screen-reader audit were not performed. Native select/date/file/password controls follow the browser/platform.
- System fonts avoid external requests; exact text metrics vary across platforms. Some full-page evidence/intake screens remain long because required disclosures and manual review controls are preserved. Mobile login scrolls naturally to its disclosure/footer.
- Compact native matrix selects can truncate long key names in their closed state; the existing selected-value title and native option list retain the full code/unit.
- No live Gemini or cloud verification was performed. Provider behavior, production data and remote login configuration were not changed. No existing credential was printed or reset.
- This is frontend presentation work. Existing functional/product limitations documented by earlier handoffs remain. PDF document appearance is unchanged.
- Owner visual review is required before commit or deployment. No production behavior is represented as verified remotely.

## Rollback and deployment

Nothing is staged or committed. Review `git diff` and the new-file list first. To roll back only application appearance, restore **only** `apps/web/src/main.jsx` and `apps/web/src/styles.css` from `a9fb910`, then rebuild. To remove the review work too, separately restore the two modified existing browser tests and remove only this task's new test/docs and new status/learning entries. Preserve any owner changes made after handoff; do not use a broad reset or clean. Screenshots/logs can stay ignored for comparison. No DB rollback, API rollback or migration is needed.

Deployment status: local only. No commit, push, merge, hosting access or deployment. Stop for owner review.

## Three owner questions

1. Why can the 100% scenario look different without changing any financial value or calculation?
2. Which existing code still owns session/CSRF refresh and exact-key recovery, and why did the visual work leave that state in place?
3. Why is crimson safe for the ivory logo but unsuitable as a general muted-text or status color on every dark surface?

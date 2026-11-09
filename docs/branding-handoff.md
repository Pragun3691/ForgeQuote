# ForgeQuote branding cleanup

Owner-approved presentation-only work on `feature/forgequote-branding`, starting from accepted F2 commit `401a63cf93d3e23f5415295846afe86e5a5de08a`. The branch and clean baseline were verified before editing. `.tmp/branding-before` preserves 267 exact tracked/nonignored files, SHA-256 hashes, branch/HEAD/status and both Git patches. Existing checkpoints remain untouched.

## Before and after

Login previously repeated Synthetic demo, Demo identity, demo password help and a separate demonstration notice. It now uses Account, selected-account password help and exactly one explanatory paragraph:

> This demonstration uses shared Estimator and Sales Head accounts. Both can access all synthetic records. Use synthetic, nonconfidential data only.

Both existing role options/values remain: Estimator (`estimator`) and Sales head (`sales_head`). Username/password control IDs, names, autocomplete, password clearing, validation, CSRF/session handlers, loading/error/recovery and focus behavior are unchanged. The title is `Sign in | ForgeQuote`.

The authenticated sidebar says Synthetic data / Nonconfidential data only. The original reminder styling and mobile behavior remain. The logo, manufacturing graphic, palette, fonts, layout and navigation are unchanged. Login CSS removes only the old badge rule and its two obsolete companion-text hiding selectors; no new override layer is added.

README's product link says Open ForgeQuote. Its URL remains `https://forgequote-demo.onrender.com`; all existing URL targets, deployment evidence, financial assumptions and limitations are preserved. The introduction explains the two shared accounts and private passwords without repeating demo branding. No new hostname has been verified or adopted.

Seeded values such as Synthetic Demo Customer, Demo estimator and SPINDLE-DEMO remain factual record contents, not product branding. They may still appear in RFQs and PDFs. No records, references, issued documents or immutable snapshots were renamed. Environment-variable/provisioning names, Render configuration, APP_ORIGIN and SESSION_SECRET are untouched. No tenant isolation, registration or real customer accounts are claimed.

## Exact changed files

Application and README:

- `apps/web/src/LoginView.jsx`
- `apps/web/src/AppShell.jsx`
- `apps/web/src/styles/login.css`
- `README.md`

Browser tests (16 files; existing Demo identity selectors become Account):

- `tests/browser-auth.smoke.js`
- `tests/browser-final-workflows.smoke.js`
- `tests/browser-lifecycle.smoke.js`
- `tests/browser-m1.smoke.js`
- `tests/browser-m2.smoke.js`
- `tests/browser-m3.smoke.js`
- `tests/browser-m4.smoke.js`
- `tests/browser-m7.smoke.js`
- `tests/browser-m8.smoke.js`
- `tests/browser-pdf.smoke.js`
- `tests/browser-quotation.smoke.js`
- `tests/browser-rates-ux.smoke.js`
- `tests/browser-rfq.smoke.js`
- `tests/browser-ui.smoke.js`
- `tests/browser-version-consistency.smoke.js`
- `tests/browser-visual-v2.smoke.js`

M2 also adds exact title/account-option/help/disclosure checks, absence of the old badge/label/sidebar branding, rendered disclosure contrast coverage and explicit preservation of both Gemini consents/provider warnings. PDF/M7 strengthen actual downloaded customer/INTERNAL PDF brand checks while retaining financial/confidentiality assertions. All other browser changes are label-only; existing assertions remain.

Documentation:

- `docs/current-status.md`
- `docs/learning-log.md`
- `docs/decisions/0022-design-system-shell.md`
- `docs/branding-handoff.md` (new)

## Actual screenshot evidence

The accepted baseline was built and captured before application edits. Dedicated real-auth/disposable-database capture runs produced 12 before and 12 after images: login, Estimator sidebar and Sales Head sidebar at 1440x1000, 768x1024, 390x844 and 320x844 viewports. Images are full-page captures, so mobile content can extend below the viewport with ordinary vertical scrolling. Every capture checked page width for horizontal overflow. No production data or credentials are in these images; synthetic record names intentionally remain.

| View | Before | After |
| --- | --- | --- |
| Desktop login | [1440](../.tmp/branding/before/login-1440.png) | [1440](../.tmp/branding/after/login-1440.png) |
| Mobile login | [390](../.tmp/branding/before/login-390.png) | [390](../.tmp/branding/after/login-390.png) |
| Desktop Estimator sidebar | [1440](../.tmp/branding/before/sidebar-estimator-1440.png) | [1440](../.tmp/branding/after/sidebar-estimator-1440.png) |
| Mobile Estimator navigation | [390](../.tmp/branding/before/sidebar-estimator-390.png) | [390](../.tmp/branding/after/sidebar-estimator-390.png) |
| Desktop Sales Head sidebar | [1440](../.tmp/branding/before/sidebar-sales_head-1440.png) | [1440](../.tmp/branding/after/sidebar-sales_head-1440.png) |
| Mobile Sales Head navigation | [390](../.tmp/branding/before/sidebar-sales_head-390.png) | [390](../.tmp/branding/after/sidebar-sales_head-390.png) |

Tablet/320 images and capture manifests are in the same before/after directories. These are ignored local artifacts and are not committed. Desktop/mobile login and both-role sidebar captures were personally inspected. Capture tooling waits for loaded register/approval data in the refreshed after set; an earlier after capture caught a legitimate in-flight read and was replaced with the loaded view. No UI was altered to fabricate success. The M2 suite separately captures viewport/full-page layouts and actual Chrome 200%/400% host zoom.

## Verification

| Check | Actual result |
| --- | --- |
| Dedicated before/after captures | Both passed: 12 images each, both roles, four widths, zero page errors/overflow. |
| Focused M2 browser suite | Passed, exit 0: branding, auth/validation/recovery, keyboard/focus, responsive/reduced motion, 35 contrast pairs, real 200%/400% zoom and unchanged Gemini warnings/consents. |
| Complete browser runner | All 21 suites passed, exit 0, including M1/F2, M7/F1, both-role journeys, responsive/keyboard/zoom, Gemini and actual customer/INTERNAL PDF branding checks. |
| Frontend helpers | 24 passed; zero failures/skips. |
| Existing units | 90 passed; zero failures/skips. |
| Financial | 33 passed; all nine golden cases unchanged. |
| API/database/security | 137 passed; zero failures/skips; process exit 0. |
| API syntax | 47 modules passed. |
| Production frontend build | Passed, 62 modules. |
| Actual production startup | 1/1 passed, serving built React and liveness. Its database is deliberately unavailable; this is not a live production readiness claim. |

Commands from repository root: `node .tmp/t06-run.mjs tests/browser-m2.smoke.js`; `node .tmp/t06-run.mjs tests/run-browser-suites.js`; `node --test tests/rate-authoring.test.js tests/rate-view.test.js tests/intake-validation.test.js tests/intake-review.test.js tests/m1-state.test.js tests/register-view.test.js tests/ui-format.test.js tests/ui-evidence.test.js`; `npm.cmd test`; `npm.cmd run test:costing`; `node .tmp/t06-run.mjs .tmp/m5-m6-db.mjs`; `npm.cmd run check:api`; `npm.cmd run build`; `npm.cmd run test:production`. Dedicated captures use `BRANDING_STAGE=before` or `after` with `.tmp/branding-capture.mjs` through the same guarded launcher. These existing/local ignored wrappers provide disposable targets without exposing configuration values.

Logs: `.tmp/branding-focused.log`, `.tmp/branding-browser-all.log`, `.tmp/branding-unit.log`, `.tmp/branding-frontend.log`, `.tmp/branding-financial.log`, `.tmp/branding-api.log`, `.tmp/branding-syntax.log`, `.tmp/branding-build.log`, `.tmp/branding-startup.log`, `.tmp/branding-capture-before.log`, `.tmp/branding-capture-after.log`. Writable verification uses only guarded disposable local test databases and synthetic fixtures. No forgequote_dev reset/seed/write, production database access or live Gemini call.

Integrity evidence in `.tmp/branding-integrity.json` confirms exactly 23 pre-existing files changed and this one handoff was added. All other 244 baseline files are byte-identical, including all 87 backend files, F1/F2 application corrections, both Gemini components, PDF renderers, original branding SVGs, design tokens, package manifests/lockfile and Render configuration. README URL targets are identical to the baseline. Thirteen browser files are strictly label-only changes; M2/PDF/M7 only add the documented checks and keep existing assertions. HEAD and the empty index remain unchanged.

## Limits, deployment and rollback

Branding cleanup is implemented and locally verified, ready for owner review. All requested verification gates passed without failed/skipped tests in this assignment. `git diff --check` passed. No commit or push is authorized/performed yet.

Verification is local Chrome evidence, including both roles and responsive/zoom/focus checks. Safari/Firefox, physical devices, screen-reader user testing, live provider connectivity and production behavior are not newly verified. Shared synthetic-record access and authenticated-tab draft lifetime remain explicit limitations. Gemini-specific restrictions and both consent checkboxes remain verbatim; the product cleanup is not permission to submit confidential data to unpaid Gemini.

There are no backend/schema/API, financial formula, authorization, package, font, provisioning or PDF-renderer changes. The F1 and F2 application corrections remain unchanged. No production URL, Render service setting or runtime secret was changed. No staging, commit, push, main merge or deployment. Stop for owner review; integration/hostname migration remains separately authorized work.

For owner-authorized rollback, first preserve subsequent work in a new checkpoint. Restore only the 23 pre-existing assignment files above from their matching `.tmp/branding-before` paths, then preserve/archive the newly added handoff separately. Restore application and selector changes together so tests use the matching accessible label. Rebuild and run the focused browser/auth checks. Do not reset, clean, stash or rewrite history; no database rollback applies.

Owner understanding questions: Why must shared-account/synthetic-data disclosure remain after removing repeated Demo branding? Why does the Account label change require browser-selector changes but no authentication change? Why must the current production link and immutable record/PDF names remain unchanged during this cleanup?

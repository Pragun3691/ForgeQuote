# Tier 1 visual refinement - November 8, 2026

Implemented locally on the existing `feature/forgequote-ui-redesign` branch. **Visual approval is pending. Stop for owner review.** No commit, push, merge, deployment or Tier 2 work.

The owner reviewed the original 14 screenshots and requested these refinements. Prior uncommitted work, README, `.tmp/submission/`, the original `.tmp/ui-review/` screenshots and `.tmp/ui-redesign-review.patch` are preserved. This report supplements the historical first-pass handoff.

## Changes against the first pass

| Requested priority | Implemented result |
| --- | --- |
| Desktop navigation | Compact 208px sidebar with workspace links, neutral active state and identity/role/sign-out/demo notice at the bottom. At 900px and below, it becomes a compact sticky header with horizontal navigation. Copper remains reserved for actions. |
| RFQ register | One heading/action row, separate reference/customer/due/estimator/status/action columns and consistent table spacing. Removed the redundant catalogue link and demo badge from the page; navigation/notice remain in the shell. |
| Pending approvals | Semantic table with actual RFQ reference/customer, version, saved annual value excluding GST and review link. No invented dates, amounts or metrics. Existing refresh/loading/empty/error behavior preserved. |
| RFQ detail | RFQ status and assigned estimator appear once in the title block. Outcome decisions/recovery/errors/history remain; no empty repeated outcome panel. Version navigation is higher. Saved combined baseline appears once next to lifecycle actions. Part facts sit beside the existing costing form on desktop. |
| Rate catalogue | One compact table with key/unit, applicable rate, category and effective start. History expands inside a full-width row, with period boundaries, exact stored decimals, IDs, timestamps and recorded author/reason. Authoring stays below the table with its original inputs and recovery. |
| Mobile tables | Explicit remaining-direction scroll hints and edge rules, keyboard-focusable labelled scroll regions, sticky RFQ reference column and visible key/current-rate columns at 390px. Tables preserve their financial row/column relationships. |

`rateLabel` removes only trailing fractional zeros from display strings. It does not round or convert to Number. Money keeps its paise; stored strings, submitted inputs, rate history and calculation outputs are untouched. Exact rate strings remain visible in expanded history and available in the current-value title.

The new `ScrollTable` uses ResizeObserver and scroll position to show honest overflow cues. There is no gradient, decorative graphic, chart, dashboard metric, new package, backend change or new feature.

## Files touched in this refinement

Application:

- `apps/web/src/main.jsx`
- `apps/web/src/Workspace.jsx`
- `apps/web/src/QuoteLifecycle.jsx`
- `apps/web/src/QuoteResults.jsx`
- `apps/web/src/FinalWorkflows.jsx`
- `apps/web/src/RateCatalogue.jsx`
- `apps/web/src/format.js`
- `apps/web/src/styles.css`
- `apps/web/src/ScrollTable.jsx` (new)

Tests:

- `tests/ui-format.test.js`
- `tests/browser-ui.smoke.js`
- `tests/browser-rates-ux.smoke.js`
- `tests/browser-final-workflows.smoke.js`

Documentation:

- `docs/current-status.md`
- `docs/learning-log.md`
- `docs/decisions/0018-drafting-sheet-ui.md`
- `docs/ui-redesign-handoff.md` (historical handoff pointer)
- `docs/ui-refinement-handoff.md` (new)
- `tasks/ui-redesign.md`

The original first-pass manifest still describes the other uncommitted changes. The combined review patch is `.tmp/ui-refinement-review.patch`. No endpoint, schema, migration, package, financial assumption, auth/CSRF rule, extraction path, approval rule, rate resolver or PDF service changed.

## Fresh verification

| Command | Result |
| --- | --- |
| `npm.cmd run build` | PASS; final Vite build, 35 modules |
| `npm.cmd test` | 90/90 PASS, including all nine unchanged costing golden cases |
| `node --test tests/ui-format.test.js` | 3/3 PASS; exact large decimals, zero/significant digits, trailing-zero trimming, monetary paise, Kolkata date boundary |
| `node .tmp/t06-run.mjs --test apps/api/test/lifecycle.test.js apps/api/test/rate-catalogue.test.js apps/api/test/final-workflows.test.js` | 26/26 PASS, including suite parents |
| `node .tmp/ui-browser-run.mjs` | All ten existing Chrome workflow suites PASS |
| `node .tmp/t06-run.mjs tests/browser-rates-ux.smoke.js` | PASS again after the final rate-column/spacing refinement, including 320/390px checks |
| `node .tmp/t06-run.mjs tests/browser-ui.smoke.js` | PASS after final rate-column/spacing refinement; 17 updated screenshots and responsive/keyboard/contrast checks |
| `npm.cmd run test:production` | 1/1 PASS; actual production startup and React/liveness |
| `git diff --check` | PASS |

The existing runner executes auth, quotation, RFQ, AI, XLSX, AI-association, lifecycle, PDF, rates-UX and final-workflows suites through the existing local-only disposable-parent wrapper. It does not migrate/reset the existing application database. All original financial, saved-version, rate-history, authorization, consent and uncertain-response recovery assertions remain. Tests now use the single shell catalogue link instead of removed redundant links; the rate assertion checks the compact value while history retains exact precision.

Final UI-specific checks verify the 208px desktop sidebar, no redundant catalogue link, real popup preservation of unsaved intake, keyboard Tab focus, keyboard ArrowRight table scrolling, no page overflow at 1440/390px, one RFQ-status region, structured pending rows, the independent saved baseline `₹2,69,46,000.00`, Sales Head read-only defaults and exact historical `100.000000` alongside compact `100`.

All DB/browser checks use fresh synthetic local fixtures and clean up their generated databases. Gemini browser tests use the existing explicitly mocked provider; no live Gemini or cloud claim. Build requires normal filesystem access for esbuild in this Windows sandbox; PowerShell commands use npm.cmd to avoid the npm.ps1 execution-policy restriction.

## Updated screenshots and accessibility

The original screenshot set is untouched. New captures are under `.tmp/ui-refinement/`:

| Screen | Desktop | Mobile |
| --- | --- | --- |
| Sign-in | [1440px](../.tmp/ui-refinement/login-1440.png) | [390px](../.tmp/ui-refinement/login-390.png) |
| Register | [1440px](../.tmp/ui-refinement/register-1440.png) | [390px](../.tmp/ui-refinement/register-390.png) |
| Intake | [1440px](../.tmp/ui-refinement/intake-1440.png) | [390px](../.tmp/ui-refinement/intake-390.png) |
| Detail | [1440px](../.tmp/ui-refinement/detail-1440.png) | [390px](../.tmp/ui-refinement/detail-390.png) |
| Approvals | [1440px](../.tmp/ui-refinement/approvals-1440.png) | [390px](../.tmp/ui-refinement/approvals-390.png) |
| Sales Head review | [1440px](../.tmp/ui-refinement/sales-review-1440.png) | [390px](../.tmp/ui-refinement/sales-review-390.png) |
| Rates | [1440px](../.tmp/ui-refinement/rates-1440.png) | [390px](../.tmp/ui-refinement/rates-390.png) |
| Expanded history | [1440px](../.tmp/ui-refinement/rate-history-1440.png) | [390px](../.tmp/ui-refinement/rate-history-390.png) |

Extra keyboard-scroll capture: [register at 390px](../.tmp/ui-refinement/register-scrolled-390.png). Total: 17 images. Representative desktop/mobile register, approvals, detail, Sales Head review, rates and expanded history were visually inspected. No body overflow was detected on any captured screen. Tables remain intentionally scrollable.

The soft-dark palette is unchanged. Automated token checks still give minimum text contrast 4.90:1 and action-button contrast 6.07:1. Input boundaries and visible keyboard outlines remain. Status words accompany color; neutral active navigation does not misuse copper. Rate history keeps native keyboard disclosure. Scroll regions have accessible names and can be scrolled with arrow keys; edge cues update after scrolling. No full WCAG/screen-reader conformance claim.

## Local review and known limits

Use the existing local environment and demo credentials; no new migration or seed is required. From the repository, run `npm.cmd run dev:api` and `npm.cmd run dev:web` in separate terminals. Open the printed Vite URL (normally http://127.0.0.1:5173), with the existing configured local origin/API port, at 1440x1000 and 390x844, 100% zoom.

Review the sidebar and active links, RFQ row/action, pending review table, selected saved baseline, single title-block status, side-by-side costing workspace, compact rates and expanded exact history. On mobile, scroll the register/financial/history regions horizontally with touch or keyboard. Opening rates while editing intake still opens a new tab and preserves the original unsaved form. Use synthetic data only; visual inspection does not require executing state-changing actions.

No known failing checks remain. Chrome/Windows is the tested platform; Firefox, Safari and a screen-reader audit were not performed. Native date controls follow the browser/OS. Existing explicit refresh behavior and saved-version selection are unchanged. A larger production dataset still uses the existing unpaginated API; this refinement adds no pagination or analytics. Nested rate-history tables have their own scroll region, identified by a separate hint/name. IBM Plex bundling and all Tier 2 work remain deferred.

All changes remain uncommitted. For rollback, preserve the refinement review patch, then restore only explicitly reviewed files/remove only newly introduced files after checking for subsequent owner edits. Do not reset/clean broadly: prior Tier 1 work, README and submission drafts must be preserved. No database/deployment rollback is needed.

## Owner understanding questions

1. Why does compact `100` in the rate table still preserve the exact stored value `100.000000`?
2. Why can RFQ status be estimating while a saved quotation is pending approval?
3. Which state and recovery data remain unchanged when the form moves beside the part facts or rates opens in a new tab?

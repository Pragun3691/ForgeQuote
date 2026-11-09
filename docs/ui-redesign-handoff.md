# Tier 1 UI redesign handoff - November 8, 2026

Historical first-pass handoff. The owner did not approve these visuals and requested a focused refinement. Current implementation, changed-file delta and updated screenshots: [Tier 1 refinement handoff](ui-refinement-handoff.md). The original `.tmp/ui-review/` screenshots and first-pass review patch are preserved.

Implemented locally on `feature/forgequote-ui-redesign`; STOP for owner review. No commit, push, merge or deployment. No Tier 2 work.

## Scope and source preservation

Started from the clean README branch at `16ef06f2e463081636c778d3d2efc7ec1b7ece3a`, as explicitly approved. Refreshed origin references: `origin/main` is `930363b8590116596a3eae65105630bdf39ed3ff`, the README pull-request merge. `git diff HEAD origin/main --quiet` passed: the committed file trees are identical. No merge/rebase was needed or performed. README and `.tmp/submission/` were not edited. Application changes are confined to frontend presentation; no package/lockfile changes.

## Improvements by screen

| Screen | Result |
| --- | --- |
| Shared shell / sign-in | Approved dark tokens, 4px corners, compact typography, consistent controls, visible focus, username/actual role/sign-out, persistent synthetic indication. Active RFQs/rates navigation; Sales Head alone sees an Approvals link to the existing pending section. |
| RFQ register | Smaller heading, compact aligned rows, neutral written RFQ statuses, hover/focus feedback and readable dates. The pending list aligns actual saved annual values with existing RFQ/version links. |
| RFQ detail | Drawing-style customer/due/estimator/RFQ-status title block. For a selected saved version, combined annual baseline excluding GST appears beside the existing lifecycle state and allowed next action. Costing form and recovery retain their original state and requests. |
| Sales Head review | Correct role label, saved baseline and approve/reject controls near the top. Disabled RFQ-default fields are explicitly distinguished from selected-version saved inputs; the immutable results and internal PDF remain the review authority. |
| Saved results / lifecycle | Indian grouping without Number conversion, Kolkata dates/timestamps, selectable full IDs behind keyboard disclosure buttons, compact event ledger with reasons/actors. Saved amounts, exact decimal digits and inputs remain unchanged. |
| Intake | Shared dark form/evidence styling, shorter repeated instructions, contextual source/storage, Excel-template and input-limit disclosures. Gemini consent/both checkboxes, review warnings, manual fallback and uncertain-save recovery remain visible in their existing workflows. Rate navigation during intake opens a new tab; tested unsaved form preservation. |
| Rate catalogue | Shared compact controls/cards/history; exact decimal precision retained, formatted history dates and expandable IDs. Authoring, date constraints and missing-rate errors remain unchanged. |

No RFQ-register quotation badge is fabricated: its API provides RFQ outcome, not quotation lifecycle state. Lifecycle is shown from the existing lifecycle endpoint when a saved version is selected. No automatic latest-version selection or unsaved price calculation was introduced.

## Exact changed files

Frontend:

- `apps/web/src/styles.css`
- `apps/web/src/main.jsx`
- `apps/web/src/Workspace.jsx`
- `apps/web/src/QuoteResults.jsx`
- `apps/web/src/QuoteLifecycle.jsx`
- `apps/web/src/FinalWorkflows.jsx`
- `apps/web/src/RateCatalogue.jsx`
- `apps/web/src/RfqCreate.jsx`
- `apps/web/src/RfqExtraction.jsx`
- `apps/web/src/RfqDocumentImport.jsx`
- `apps/web/src/format.js` (new)
- `apps/web/src/Identifier.jsx` (new)

Tests:

- `tests/ui-format.test.js` (new)
- `tests/browser-ui.smoke.js` (new)
- `tests/browser-quotation.smoke.js` (expand the specified full rate ID before the unchanged assertion)
- `tests/browser-lifecycle.smoke.js` (expand the full issued number before the unchanged assertion)
- `tests/browser-rates-ux.smoke.js` (explicit expected display date `04 Nov 2026`; source fixture remains ISO)

Documentation:

- `docs/current-status.md`
- `docs/learning-log.md`
- `docs/ui-ux-direction.md`
- `docs/decisions/0018-drafting-sheet-ui.md` (new)
- `docs/ui-redesign-handoff.md` (this file, new)
- `tasks/ui-redesign.md` (new)

Endpoints: none added or changed. Migrations: none. Deployment status: local build only; cloud untouched.

## Verification

| Command | Result |
| --- | --- |
| `npm.cmd run build` | PASS; production React/Vite bundle |
| `npm.cmd test` | 90/90 PASS |
| `npm.cmd run test:costing` | 33/33 PASS, all nine independent financial golden cases unchanged |
| `node --test tests/ui-format.test.js` | 2/2 PASS, including a decimal larger than Number's exact integer range and a UTC-to-Kolkata day boundary |
| `node .tmp/t06-run.mjs --test apps/api/test/database.test.js apps/api/test/auth.test.js apps/api/test/quotations.test.js apps/api/test/quotation-api.test.js apps/api/test/cloud-database.test.js apps/api/test/rfq-intake.test.js apps/api/test/ai-api.test.js apps/api/test/xlsx-api.test.js apps/api/test/lifecycle.test.js apps/api/test/quotation-pdf-api.test.js apps/api/test/rate-catalogue.test.js apps/api/test/final-workflows.test.js` | 137/137 PASS, including suite parents |
| `node .tmp/ui-browser-run.mjs` | All ten existing Chrome workflow suites PASS |
| `node .tmp/t06-run.mjs tests/browser-ui.smoke.js` | PASS; additional role/navigation/focus/unsaved-form/saved-golden/ledger/contrast/responsive checks |
| `npm.cmd run check:api` | 47 source/maintenance module syntax checks PASS |
| `npm.cmd run test:production` | 1/1 PASS; actual production process starts and serves React/liveness |
| `git diff --check` | PASS |

The ten browser commands run by the local runner are the existing auth, quotation, RFQ, AI, XLSX, AI-association, lifecycle, PDF, rates-UX and final-workflows suites. Exact scripts: `tests/browser-{auth,quotation,rfq,ai,xlsx,ai-association,lifecycle,pdf,rates-ux,final-workflows}.smoke.js`. Each runs through the pre-existing `.tmp/t06-run.mjs` local-only disposable-parent wrapper; fixtures and parent databases close in finally blocks. No existing development/test database migration, reset or grant operation. The new focused suite uses the same disposable fixture helper. No live Gemini call: provider-path browser tests use the existing explicit mock provider.

Initial checks found and corrected the omitted relocated lifecycle panel. The full-ID and history-date assertions were adapted to the intentional disclosure/date presentation, retaining original identity/date expectations. Final existing-workflow run passed all ten suites. A final copy-only refinement labelled Sales Head RFQ defaults, formatted the catalogue as-of display and disclosed input limits; build and focused UI checks were rerun afterward. No business assertion or golden expectation was weakened.

PowerShell's npm.ps1 policy blocks plain `npm` here, so commands use `npm.cmd`. Sandboxed esbuild could not read its config; the same build passed with normal filesystem access. Neither issue required an application/configuration change.

## Accessibility and visual checks

Fourteen Chrome screenshots cover login, register, intake, saved detail, pending approvals, Sales Head review and rates at 1440px and 390px. Stored locally in `.tmp/ui-review/`. Representative desktop/mobile screens were visually inspected, including the rupee glyph, title block, read-only state, fields, financial table alignment and ledger. Each screen also passes a document-overflow assertion; detailed tables intentionally scroll within their containers.

Measured approved text tokens against canvas/panel/raised surfaces: primary minimum 12.35:1, secondary minimum 6.99:1, tertiary minimum 4.90:1, settled minimum 6.52:1, error minimum 5.56:1. Dark text on copper action buttons: 6.07:1. Minimums pass normal-text 4.5:1. Input boundaries use tertiary (minimum 4.90:1), not the decorative hairline. The 3px copper focus outline contrasts at least 5.15:1 against the three dark surfaces. Status words accompany color. Disabled controls remain distinguishable and readable.

Keyboard checks cover navigation Tab/focus and native disclosures; existing workflows exercise keyboard component jumps and rate history. Full identifiers use inline buttons with aria-expanded and selectable exact text. This is targeted accessibility verification, not a complete screen-reader or WCAG conformance audit. Font stack prefers installed IBM Plex; no font was downloaded or bundled. Tested Windows fallback renders ₹ correctly.

## Local browser review

Use the existing local `.env` and configured demo credentials. Do not migrate or seed an existing database for this review.

1. Open two PowerShell terminals in the repository. Run `npm.cmd run dev:api` in one and `npm.cmd run dev:web` in the other.
2. Open the Vite URL printed by the web terminal (normally `http://127.0.0.1:5173`). The Vite proxy uses the existing configured API port. Use the project's already-configured local origin if it differs.
3. Review at **1440 x 1000**, then Chrome device emulation at **390 x 844**, 100% zoom.
4. As Estimator: register -> New RFQ -> open rates while editing -> return and verify fields remain. Check AI disclosure/consents and Excel template disclosure with synthetic data only.
5. Open an existing RFQ and select a saved version. Check the title block, annual baseline, lifecycle and saved results. Use a synthetic fixture if deliberately testing new saves/issuance.
6. As Sales Head: pending Approvals -> saved version -> review baseline, rejection field and read-only defaults notice. Check rates authoring is available only to this role. Approval/issuance/outcome/rate-save actions persist real changes; visual review does not require clicking them.
7. Tab through navigation/forms/buttons, expand a short ID and copy the full value, open rate history and horizontally scroll detailed financial tables on mobile.

For a no-database-change visual reference, open the already-captured `.tmp/ui-review/` images. Production-mode local review is also possible using `npm.cmd run build` then `npm.cmd start` with the existing local configuration.

## Limits, deferred items and rollback

- No known failing checks after the documented corrections. Chrome/Windows only; Firefox, Safari and screen-reader testing were not performed. Native date-input appearance follows the browser/OS; stored input values remain ISO. Existing validation/errors keep their exact date/decimal text.
- Saved headline values still require selecting a version or recovering a saved submission. No register lifecycle field exists; it remains unavailable there without a separate read-contract change.
- Desktop-first detailed tables scroll on small screens. This pass does not convert financial tables into cards or change the calculation state.
- IBM Plex font bundling, a new Manual/Gemini/Excel mode switch, broader catalogue restructuring and all Tier 2 work are deferred.
- Existing manual refresh behavior remains for decisions made in other sessions. No polling, backend/PDF/extraction/auth changes or new service was introduced.
- All changes are uncommitted. To roll back, first retain the review patch or copy the listed files, then restore only the listed modified tracked files from HEAD and remove only the listed newly created files after checking for later owner edits. Preserve README and `.tmp/submission/`; do not use a broad clean/reset. No database or deployment rollback is required.

## Owner understanding questions

1. Why can RFQ status remain estimating while the selected quotation is pending or approved?
2. Which saved value supplies the headline, and why must changing a form field not update it?
3. How does opening rates during intake preserve unsaved edits, and how is an uncertain saved submission recovered separately?

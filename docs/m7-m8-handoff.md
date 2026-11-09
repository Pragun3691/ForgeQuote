# M7 + M8 handoff — 2026-11-09

M7 and M8 are complete locally and ready for owner review. M7 passed its independent gate before M8 began. The final complete regression passes. No later milestone, staging, commit, push, merge or deployment was performed.

## Preservation and checkpoints

Final audit owner resolution: F1 rejection-draft unload protection is corrected with a reproducing browser regression; F2's obsolete post-save refresh error is explicitly deferred as non-blocking. F2 implementation remains unchanged and no production verification is claimed. The focused correction, exact verification and separate rollback checkpoint are documented in [final-audit-resolution.md](final-audit-resolution.md). Historical milestone results below remain the evidence for those gates.

- Branch `feature/forgequote-visual-v2`, HEAD `a9fb910`; the owner's explicit branch/no-commit instructions supersede the generic AGENTS branch/commit guidance.
- `.tmp/m7-m8-before` records 252 exact tracked/nonignored untracked files, SHA-256 hashes, HEAD/branch/status and both Git patches. Earlier ignored checkpoints, dependencies, secrets and curated review artifacts remain in place. No reset, clean, stash or discard.
- After the independent M7 gate, `.tmp/m7-verified-before-m8` records 263 exact files. `.tmp/m7-accepted-review` preserves the independent acceptance screenshots/PDFs and gate results before final-suite regeneration.
- All backend/API files, migrations, financial goldens, packages/lockfile, authentication, transport and financial formatting remain unchanged. The existing issuance confirmation remains unchanged. UI work preserves state ownership, decimal strings, immutable snapshots, six-key assignment, both Gemini consent/disclosure gates, exact evidence checks and existing per-workflow recovery policies.
- All writable tests use guarded disposable local `_test` targets and synthetic fixtures. No `forgequote_dev` reset, migration, seed or application write; no production operation or live Gemini call. Test-only mocked Gemini/fault responses do not enter actual application workflows.

## M7 implementation results

| Issue | Result and preservation |
| --- | --- |
| Catalogue lacked key search/addressable filters | Search real returned code/category/unit/ID fields, truthful counts and no-match state. Category/as-of/search are hash state; typing replaces history, deliberate filters push. History expansion is keyed by actual key ID. No pagination/new endpoint/fake metrics. |
| Long authoring options lacked usable context | Authoring jump and controlled form show selected key/category/unit, applicable value at the catalogue date, latest recorded start including future starts, proposed exact value/date and server business date. Zero is supported; no monetary delta, coercion, rounding or silent date correction. |
| Future-date/reason errors surfaced late | Inline errors and focusable summary match backend plain-decimal/date/reason bounds. Validation uses only API `businessDate`, not client clock or historical `asOf`. Start must be today or later on that server date and strictly after the latest start. Server concurrency/clock/role checks remain authoritative. |
| Ordinary authoring could be confused with recorded recovery | Retained owner and inputs survive refresh/navigation. Explicit confirmed discard clears only the working draft and validation state. Unknown saves show read-only original path/body/key and exact retry. Existing persist-before-POST/replay/rejection semantics remain. |
| Rejection reason was local to an unmounted version | Rejection reason is an authenticated-memory draft keyed by immutable version; lost reason keeps its existing RFQ scope and gains dirty tracking. Retained reasons remain dirty while their view is unmounted. No new disk/source persistence or claim of crash recovery. |
| Decisions/outcomes submitted without review | Approval/rejection confirmations name RFQ, customer, saved version and annual ex-GST value; rejection includes the exact reason and terminal-for-version consequence. Won/lost review names the RFQ and terminal consequence; lost reason remains required. Cancel/Escape produces no write/storage action. Initial Cancel focus, Tab/Shift+Tab wrap and initiating-control restoration; synchronous guards prevent duplicate confirmation. |
| Mixed progress and stale action feedback | Known server success produces success feedback; read errors remain separate from action/storage errors. New lifecycle actions require a successful status read. Frozen pending requests retain explicit same-key recovery. Refreshes preserve selected versions and working inputs; no background focus movement. |
| Shared PDF busy/error state obscured the requested document | Separate customer/INTERNAL sections, confidentiality and eligibility guidance, document-specific preparation/errors, stable button names and honest “browser download requested” feedback. Binary request aborts when its version component leaves; late response cannot download into a different context. Lifecycle errors are not cleared by document success/failure. |
| Outcome controls were cramped in the title footer | Dedicated responsive outcome area, readable reason/history and explicit sent/terminal meaning. Sent still derives from actual issuance; no email-delivery claim, new sent action, reopening or backend transition. |

Existing `IssueConfirmation.jsx` and its parent issuance duplicate-confirm guard remain. Parent action guards supplement same-key recovery without changing endpoints, financial thresholds or accepted rejection/replay rules. No new rate keys, backdating, edits/deletes or broad permissions.

**Independent M7 gate:** 20/20 browser suites, 24/24 frontend helper tests, 90/90 existing units, 137/137 API/database tests, 33/33 costing tests with all nine existing goldens unchanged, 47 API syntax modules, 62-module production build and startup 1/1. Four-viewport screenshots plus eight actual PDF downloads/renders inspected. Only then was M8 started.

## M8 product review and results

The review found real task friction beyond passing existing tests:

1. Approval/issuance, documents and RFQ outcome required scroll hunting on long detail pages. Add explicit task jumps only when their actual targets exist; focus lands visibly below the header at all required widths and native zoom. No hash, selected-version or draft change.
2. Multipart rate assignment followed all part editors. Add a direct matrix jump for multipart intake, using the existing single set of controlled selects and stable part identities.
3. Rate preview appeared after the save action. Move it before submission in document/keyboard order, with no remount or request-body change.
4. Architecture documentation described approvals, intake and PDFs as future work. Replace that outdated checkpoint description with current implemented flows, state/trust boundaries and explicit unimplemented scope.

The new M8 acceptance suite performs three complete **real UI → API → disposable PostgreSQL** journeys: manual, Excel and mocked Gemini intake; review/correction; actual RFQ persistence; costing; Sales Head queue/saved-input review and approval; Estimator issuance; customer/INTERNAL downloads; Sales Head terminal loss; cross-session refresh. The multipart spindle uses the independent accepted ₹149.70 golden by part identity, not the first display row. It also verifies keyboard decision focus, visible section jumps, preview ordering, document-scoped failure, aborted late PDF response, and true Chrome 200%/400% host zoom. It creates three actual RFQ submission receipts, makes exactly one mocked-provider request and downloads 24 real PDFs. It does not simulate successful application writes.

Existing suites retain 1/2/20-part intake, removal/undo, per-field Gemini application, missing/ambiguous/invalid evidence, both consent resets, Excel rejection/fallback, golden scenarios, historical consistency, committed-response loss, role denial, CSRF/session/storage boundaries and terminal/issuance recovery.

## Exact changed files

Relative to `.tmp/m7-m8-before`; unrelated accepted M1–M6 work is retained. Exact phase deltas/hashes: `.tmp/m7-m8-review/changed-files.json`.

| File | Change |
| --- | --- |
| `apps/web/src/RateCatalogue.jsx` | M7 returned-data search, URL filters/history, counts, authoring jump |
| `apps/web/src/FinalWorkflows.jsx` | M7 authoring owner/review/discard, exact recovery, outcome dirty/confirmation/duplicate guard; M8 outcome focus target |
| `apps/web/src/QuoteLifecycle.jsx` | M7 rejection memory, review/recovery/status feedback and PDF integration; M8 lifecycle target |
| `apps/web/src/Workspace.jsx` | M7 outcome layout; M8 real lifecycle/document/outcome jumps |
| `apps/web/src/RateKeyMatrix.jsx` | M8 focusable matrix heading |
| `apps/web/src/RfqCreate.jsx` | M8 matrix jump only; original form/save/recovery owner preserved |
| `apps/web/src/styles/workflows.css` | M7 rate/recovery/decision/document/outcome layouts; M8 preview placement |
| `apps/web/src/rate-view.js` | New M7 pure URL/filter helpers |
| `apps/web/src/rate-authoring.js` | New M7 string-safe date/decimal/reason validation |
| `apps/web/src/RateAuthorForm.jsx` | New M7 controlled presentation; M8 review-before-save order |
| `apps/web/src/RecordedActionSummary.jsx` | New M7 read-only original intent |
| `apps/web/src/DecisionConfirmation.jsx` | New M7 accessible native action review |
| `apps/web/src/PdfDownloads.jsx` | New M7 version-bound binary requests and separate feedback; M8 focus target |
| `tests/rate-view.test.js` | New filter/history/nonmutation tests |
| `tests/rate-authoring.test.js` | New server-date/future-start/precision/reason tests |
| `tests/browser-m7.smoke.js` | New independent M7 acceptance and PDF capture |
| `tests/browser-m8.smoke.js` | New joined product journeys/quality acceptance |
| `tests/browser-lifecycle.smoke.js` | Explicit confirmation steps; original threshold/issuance/replay assertions retained |
| `tests/browser-final-workflows.smoke.js` | Explicit terminal confirmation; original loss/replay/role assertions retained |
| `tests/browser-version-consistency.smoke.js` | Narrow heading lookup to unchanged level-2 version heading after adding document subsection headings; financial/version assertions unchanged |
| `tests/run-browser-suites.js` | Add M7 then M8, 20 then 21 suites |
| `docs/architecture.md` | Current implemented architecture and evidence limits |
| `docs/decisions/0027-rates-decisions-documents.md` | Interaction/ownership decisions and M8 refinements |
| `tasks/m7-m8-quality-acceptance.md` | Authorized sequential scope, checkpoints/gates |
| `docs/current-status.md` | Completion and owner-review stop |
| `docs/learning-log.md` | Validation, decision/download and verification lessons |
| `docs/m7-m8-handoff.md` | This handoff |

Other proposed edits proved unnecessary: existing PDF/rates/M1 browser suites already verify their retained behaviors and remain unchanged; no generic component rewrite or financial refactor was performed.

## Commands and exact test results

| Gate | Command | Result / evidence |
| --- | --- | --- |
| M7 helper tests | `node --test tests/rate-authoring.test.js tests/rate-view.test.js tests/intake-validation.test.js tests/intake-review.test.js tests/m1-state.test.js tests/register-view.test.js tests/ui-format.test.js tests/ui-evidence.test.js` | 24 passed, 0 failed/skipped; `.tmp/m7-unit.log` |
| M7 complete browser gate | `node .tmp/t06-run.mjs tests/run-browser-suites.js` (20-suite runner) | 20/20 passed, exit 0; `.tmp/m7-all-browser.log` and `.tmp/m7-accepted-review/gate.json` |
| M7 remaining regressions | `npm.cmd test`; `npm.cmd run test:costing`; guarded DB bridge; build/startup/syntax | 90/90 units, 33/33 costing, 137/137 DB/API, 47 modules, build 62, startup 1/1; `.tmp/m7-*.log` |
| M8 focused acceptance | `node .tmp/t06-run.mjs tests/browser-m8.smoke.js` | Passed three joined journeys; `.tmp/m8-focused.log`; final expanded capture also passed inside full runner |
| Final helper tests | Same eight-file Node helper command above | 24 passed, 0 failed/skipped; `.tmp/m8-unit.log` |
| Existing units | `npm.cmd test` | 90 passed, 0 failed/skipped; `.tmp/m8-api-unit.log` |
| Financial regression | `npm.cmd run test:costing` | 33 passed, 0 failed/skipped; nine goldens unchanged; `.tmp/m8-costing.log` |
| API/database/security | `node .tmp/t06-run.mjs .tmp/m5-m6-db.mjs` | Exact unchanged package `test:db` Node test list: 137 passed, 0 failed/skipped, child exit 0; `.tmp/m8-database.log` |
| API syntax | `npm.cmd run check:api` | 47 source/maintenance modules passed; `.tmp/m8-syntax.log` |
| Complete final browser regression | `node .tmp/t06-run.mjs tests/run-browser-suites.js` | **21/21 passed, exit 0**; `.tmp/m8-all-browser-rerun.log` |
| Production build | `npm.cmd run build` | Passed, 62 modules; `.tmp/m8-build.log` |
| Actual production startup | `npm.cmd run test:production` | 1 passed, 0 failed/skipped; `.tmp/m8-production.log` |
| Actual PDF rendering | `node .tmp/render-m7.mjs`; `node .tmp/contact-m7.mjs`; `node .tmp/render-m8.mjs` | 32 downloaded PDFs, 108 rendered pages, 16 contact sheets; `.tmp/m7-pdf-render.log`, `.tmp/m8-pdf-render.log` |

The final 21 suites: auth, quotation, rfq, ai, xlsx, ai-association, lifecycle, pdf, rates-ux, final-workflows, ui, version-consistency, visual-v2, m1, m2, m3, m4, m5, m6, m7 and m8. Counts overlap (for example, costing tests are also in existing units); do not add them into a fictitious independent-test total.

The ignored local wrapper privately checks localhost maintenance configuration, creates a random disposable `_test` parent and overrides child DB variables. Browser fixtures create dedicated disposable databases. The shell-free DB bridge executes the unchanged existing test list. Production startup launches the actual production child, serves React/assets/liveness and correctly reports DB-unavailable readiness in its deliberately disconnected DB configuration. Real authenticated database behavior is separately covered by API/browser fixtures; startup is not a cloud-readiness claim.

Corrections during verification, not hidden successes:

- New document headings made an old unqualified heading selector ambiguous; narrowed to its exact level without weakening version/financial checks.
- A cross-session test assumed the other actor's status pushed live; corrected to use the existing explicit refresh.
- M8's first golden lookup assumed display order; it now identifies the spindle, preserving accepted copied sorting and immutable data.
- The first 24-download attempt reached the unchanged 20-per-actor PDF limit. Final journeys use Estimator for customer and Sales Head for INTERNAL downloads (12 each), exercising legitimate role access without weakening limits.
- One final aggregate attempt timed out during the existing child test API shutdown. No backend or timeout assertion was changed. The full rerun passed; initial evidence remains `.tmp/m8-all-browser.log`.
- Standard Playwright screenshot clipping produced a blank artifact at native 400% zoom despite passing DOM focus checks. Visual inspection caught it; final M8 uses the native-frame CDP method already used by M2. Corrected actual 200%/400% images were inspected after the passing run.

## Screenshots, PDF evidence and inspection

Curated evidence: `.tmp/m7-m8-review/artifacts.json` records source path, kind and SHA-256 for **86 current browser screenshots, two accepted-before references, 32 actual PDF downloads, 108 page renders and 16 contact sheets**. Prior curated evidence remains preserved. Final PDF pages were regenerated from the passing-run downloads, not fabricated mockups.

| Surface | Desktop / tablet | Mobile / narrow |
| --- | --- | --- |
| Rate validation/preview | [Preview 1440](../.tmp/m7-m8-review/m7-rate-preview-1440.png), [validation 768](../.tmp/m7-m8-review/m7-rate-validation-768.png) | [Preview 320](../.tmp/m7-m8-review/m7-rate-preview-320.png), [review order 390](../.tmp/m7-m8-review/m8-rate-review-order-390.png), [accepted-before authoring](../.tmp/m7-m8-review/accepted-before-author-390.png) |
| Exact recovery | [1440](../.tmp/m7-m8-review/m7-rate-recovery-1440.png) | [320](../.tmp/m7-m8-review/m7-rate-recovery-320.png) |
| Decision/outcome review | [Rejection 1440](../.tmp/m7-m8-review/m7-rejection-review-1440.png) | [Outcome 390](../.tmp/m7-m8-review/m7-outcome-review-390.png), [rejection 320](../.tmp/m7-m8-review/m7-rejection-review-320.png) |
| Intake | [Manual 1440](../.tmp/m7-m8-review/m8-manual-inputs-1440.png), [Excel 768](../.tmp/m7-m8-review/m8-excel-source-review-768.png) | [Gemini 320](../.tmp/m7-m8-review/m8-gemini-source-review-320.png), [matrix 390](../.tmp/m7-m8-review/m8-multipart-matrix-390.png) |
| Sales Head review | [768](../.tmp/m7-m8-review/m8-manual-sales-review-768.png) | [390](../.tmp/m7-m8-review/m8-manual-sales-review-390.png) |
| Issuance/documents | [Issuance 1440](../.tmp/m7-m8-review/m8-issuance-review-1440.png), [documents 768](../.tmp/m7-m8-review/m8-manual-documents-768.png) | [Documents 320](../.tmp/m7-m8-review/m8-manual-documents-320.png), [scoped error 390](../.tmp/m7-m8-review/m8-document-error-390.png) |
| Native host zoom | [200%](../.tmp/m7-m8-review/m8-documents-zoom-200.png), [400%](../.tmp/m7-m8-review/m8-documents-zoom-400.png) | M2 also rechecks both-role login/costing/rates/issuance zoom |
| Product regression | [Login 1440](../.tmp/m7-m8-review/product-login-1440.png), [register 1440](../.tmp/m7-m8-review/product-register-1440.png) | [Approvals 390](../.tmp/m7-m8-review/product-approvals-390.png), [working inputs](../.tmp/m7-m8-review/product-working-inputs-390.png), [comparison 320](../.tmp/m7-m8-review/product-saved-comparison-320.png), [provenance](../.tmp/m7-m8-review/product-provenance-390.png), [twenty-part Sales Head](../.tmp/m7-m8-review/product-twenty-sales-inputs-390.png) |

Actual final example files: [customer quotation](../.tmp/m7-m8-review/m8-manual-customer-320.pdf), [multipart INTERNAL report](../.tmp/m7-m8-review/m8-ai-internal-320.pdf), [multipart customer PDF](../.tmp/m7-m8-review/m8-ai-customer-320.pdf). Rendered examples: [manual 320 contact sheet](../.tmp/m7-m8-review/m8-pdf-pages/contact-manual-320.png), [Excel 768](../.tmp/m7-m8-review/m8-pdf-pages/contact-excel-768.png), [multipart 1440](../.tmp/m7-m8-review/m8-pdf-pages/contact-ai-1440.png).

Personally inspected actual desktop/tablet/mobile/narrow rate, recovery, confirmation, intake/evidence, Sales Head, document/error and native-zoom captures. Reviewed PDF contact sheets for every viewport/mode and full-size representative customer/INTERNAL pages for typography, rupee glyphs, table wrapping, confidentiality labels, totals and continuation pages. Existing A4 PDF templates/branding/order/pagination remain server-owned and unchanged; viewport affects the download workflow, not A4 document layout.

## Accessibility and coverage limits

- Automated execution uses installed Chrome on Windows. Keyboard focus/return/cycling, visible task jumps below sticky surfaces, named table scrolling, reduced motion and computed contrast/35 existing palette combinations pass. Native host zoom 200%/400% is exercised, including the new document/task controls. This is not a full WCAG conformance or assistive-technology user-study claim.
- Required UI viewports: 1440×1000, 768×1024, 390×844 and 320×844. Existing tablet/breakpoint checks remain. Wide financial/history tables intentionally scroll inside named regions; page-level overflow checks pass. Native selects can truncate long selected codes; full options/title remain available.
- Gemini is mocked in deterministic acceptance. Live provider connectivity/terms revalidation, cloud deployment/TLS, email/customer delivery, Safari/Firefox, physical phones/tablets and screen-reader user testing are not newly verified.
- Ordinary unsent drafts remain authenticated-tab memory, not crash-safe backend drafts. Internal navigation preserves them; sign-out/session teardown ends that lifetime. Existing submitted request recovery depends on same-tab sessionStorage. Source/file/evidence are not newly persisted.
- No realtime cross-session subscription exists. Refresh retrieves another actor's decisions; client clocks do not determine rate-effective validation. Server-side date/concurrency checks can still reject a now-stale preview, with explicit feedback.
- Long multipart/evidence documents remain long; task jumps reduce hunting without virtualization or another form model. Rate search covers the returned list, not server pagination.
- PDF disk saving remains controlled by the browser. Existing PDF limits, fonts, fixed A4 layout and sometimes sparse continuation pages remain unchanged. Frontend copied part ordering does not rewrite the server's snapshot/PDF ordering or historical documents.
- This remains the accepted two-role synthetic demo. Multi-tenant identity/isolation, invitations, new account administration, ERP and legal invoice compliance require separate scope. No fake controls were introduced.

## Rollback

No rollback was executed. Do not reset to HEAD or use older M1–M6 checkpoints: accepted work is still uncommitted.

1. Preserve newer owner edits first; compare hashes against `.tmp/m7-m8-review/changed-files.json` and the checkpoint manifests.
2. Combined rollback: restore only assignment-modified existing files from `.tmp/m7-m8-before`; remove only assignment-created files listed in the combined delta, after checking for later edits. Keep unrelated files/checkpoints/artifacts.
3. M8-only rollback: restore only M8-modified existing files from `.tmp/m7-verified-before-m8`, remove M8-created files such as its browser suite, and reconcile final status/learning/handoff metadata to describe retained M7. Preserve the independent verified-M7 implementation and evidence.
4. Rebuild and run the retained milestone's regression. Shared imports/styles/runner must be restored coherently. No database, schema, credential, financial or API rollback is needed.

Example single-file restoration, **not executed**:

```powershell
Copy-Item -LiteralPath '.tmp/m7-verified-before-m8/apps/web/src/Workspace.jsx' -Destination 'apps/web/src/Workspace.jsx'
```

Deployment status: local working tree only. No staging, commit, push, merge or deployment. Stop for owner review.

## Three owner understanding questions

1. Why must the rate form distinguish historical `asOf`, API `businessDate` and the latest future effective start, and still allow the server to reject a stale preview?
2. What distinguishes a cancelled confirmation, an uncertain recorded request and a server-confirmed result—and why must recovery reuse the original path/body/key?
3. Why can an INTERNAL PDF show a historical saved version while a customer PDF requires the current issued version, and why does neither download prove email delivery or disk persistence?

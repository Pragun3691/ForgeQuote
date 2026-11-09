# M5 + M6 implementation handoff — 2026-11-09

M5 and M6 are complete locally and ready for owner review. M5 passed its independent gate before M6 began. The complete final regression passed. No later milestone, staging, commit, push, merge or deployment was performed.

## Preserved state and boundaries

- Branch: `feature/forgequote-visual-v2`; HEAD: `a9fb910`. The owner explicitly approved continuing this branch and forbade commits, superseding AGENTS' generic task-branch/commit guidance.
- Before edits, `.tmp/m5-m6-before` captured 240 exact tracked/nonignored untracked files, SHA-256 hashes, Git status, HEAD and staged/unstaged binary patches. The independent M5 gate preceded the 245-file `.tmp/m5-verified-before-m6` checkpoint. Existing ignored dependencies, secrets and earlier curated review artifacts remained in place. No reset, clean, stash or discard.
- All `apps/api` files, financial goldens, package manifests/lockfile, auth handlers, routing/state owners, costing and lifecycle code remain unchanged from the pre-M5 checkpoint. No endpoints, migrations, API contract, financial formula, GST/margin/rounding, snapshot, authorization or provider-policy change. No new dependencies.
- All writable database tests used guarded disposable local `_test` databases, dedicated browser databases and synthetic fixtures. No `forgequote_dev` writes, resets, migrations or seeds; no production data use; no live Gemini request.

## M5 — manual intake and six-key assignment

| Prior issue | Implemented behavior |
| --- | --- |
| Native quantity pattern accepted values above 1,000,000,000; zero weight/cycle passed; text/date/duplicate failures reached the server | String-safe frontend validation matches the actual backend limits, with backend-canonicalizer parity tests. Weight/cycle must be positive, setup may be zero; six decimal places/12 integer digits; quantity 1–1,000,000,000; trimmed case-sensitive part uniqueness; exact calendar-date validation and control-character rejection. No draft or decimal normalization. |
| Required feedback could claim readiness for nonempty invalid values | Component counts include invalid inputs. Inline errors appear after blur or a deliberate save attempt, with stable accessible names and linked descriptions. A focused error summary links directly to each input. |
| Index keys reused inputs and matrix rows when parts were removed | UI-only part UUIDs survive edits, removal and undo. They are never included in API bodies/storage. Controlled editor extraction keeps ownership with RfqCreate. |
| Immediate removal/replacement could lose entered values or key selections | One-step removal undo preserves the removed part and its six keys. Common-key copying and source replacement of populated inputs require explicit replacement review; cancel makes no changes. Final review resets only after actual edits/application. |
| Wide matrix was difficult on phones; invalid selected categories were unclear | One set of controlled native selects remains a compact desktop/tablet table and becomes stacked, labelled per-part assignments at ≤640px. Category mismatch/unavailable keys are explicit. Missing effective history stays a visible warning, not an intake blocker. No guessed rates or automatic suggestions. |
| New validation could interfere with durable retries | Original persist-before-POST, exact body/key storage and frozen retry flow remain. New draft validation is bypassed for frozen same-key recovery; no automatic replay. Existing RFQ/Excel lost-response suites pass. |

M5 independent gate: 16 frontend helper tests; new real browser 1/2/20-part saves, invalid quantities/duplicate parts with zero writes, removal/undo/stable DOM, review cancel/confirm, navigation/draft preservation and four viewport widths; original RFQ, rates UX (both roles), ten M1 cases, Excel and Gemini suites; 55-module production build. All passed before the verified-M5 checkpoint.

## M6 — source → review → apply

| Area | Implemented behavior |
| --- | --- |
| Excel source | Selected file name/byte count and format/size feedback; original synthetic-data attestation and deterministic server parser retained. Source filename is displayed locally; the transport still uses the safe fixed filename. |
| Excel review/correction | Worksheet-row review buttons focus the correct row; cell/header references, raw/normalized strings, verified/missing status and manual-correction instructions stay visible. Bulk application preserves header fields, clears internal keys, requires replacement review when populated, and focuses manual validation after confirmation. Invalid workbooks remain explicit server errors with manual fallback. No spreadsheet dependency or second editable form model. |
| Gemini evidence | Existing exact UTF-16, end-exclusive source highlighting and return-to-field behavior reused. Client application additionally requires server `verified` status, a nonempty normalized string and every evidence span valid against the exact submitted source. Invalid/missing evidence is rejected even if a response incorrectly labels it verified. No guessing, fuzzy matching, confidence score or client-side promotion. |
| Individual application | Each supported verified field offers a named apply action. Part fields require an explicitly chosen stable manual-part identity. Removing a target disables the action instead of retargeting another row. Populated unequal values require replacement review; all other inputs and six keys remain unchanged. Customer material remains informational and cannot become a rate key/API field. |
| Bulk application | Uses the same evidence guard. Clearly explains replacement and key clearing. Nonverified fields remain empty for correction. Feedback says working inputs/no RFQ saved; final human review remains required. No RFQ POST is triggered by any review/apply action. |
| Consent/disclosure | Both Gemini checkboxes, unpaid-service provider terms, synthetic-only restriction, personal/customer/NDA warnings and AI-never-prices warning retained. Source editing clears both consents and old review/highlighting. Source/file/evidence remain transient. |
| Cancellation/retry | Import and extraction completions are owned by their current controller. Cancel releases the manual form immediately; stale results, errors, 401 handling and finally blocks cannot affect a later request. Persistent parent fallback feedback remains after panel closure. Explicit retry starts a source request only. |
| Focus | Modal starts on the safe cancel action, supports Escape and restores its initiating control. Background refreshes/individual field application do not move focus. Confirmed bulk application deliberately focuses manual validation. |

M6 independent acceptance passed: exact/invalid evidence, ambiguous/missing fields, both consent gates, source-edit reset, named header/part application, overwrite cancel/confirm/focus return, stable targets through part removal, no rate-key loss on individual apply, zero automatic RFQ saves, Gemini/Excel cancel-retry, cell review and four viewport widths. Provider mocked; real browser/API/PostgreSQL.

## Exact changed files

Relative to `.tmp/m5-m6-before`; pre-existing M1–M4 files/changes outside this list are retained. Machine-readable phase deltas and final hashes: `.tmp/m5-m6-review/changed-files.json`.

| File | Milestone/purpose |
| --- | --- |
| `apps/web/src/RfqCreate.jsx` | M5/M6 validation, stable identities, undo/replacement, explicit application; original form/recovery owner |
| `apps/web/src/RateKeyMatrix.jsx` | M5 stable rows, errors/category mismatch, labelled mobile cells |
| `apps/web/src/IntakePartEditor.jsx` | New M5 controlled input presentation |
| `apps/web/src/IntakeReviewDialog.jsx` | New M5 replacement modal; M6 explicit focus-return correction |
| `apps/web/src/intake-validation.js` | New M5 backend-matched draft validation |
| `apps/web/src/intake-review.js` | New M6 exact-evidence application guard and supported fields |
| `apps/web/src/RfqDocumentImport.jsx` | M6 file/row/field review, correction guidance and request ownership |
| `apps/web/src/RfqExtraction.jsx` | M6 individual apply, target choice, evidence guard and request ownership |
| `apps/web/src/styles/workflows.css` | M5/M6 errors, modal, responsive matrix and source/application styling |
| `tests/intake-validation.test.js` | New M5 explicit bounds and actual-backend parity tests |
| `tests/intake-review.test.js` | New M6 evidence rejection/exact string tests |
| `tests/browser-m5.smoke.js` | New M5 acceptance suite |
| `tests/browser-m6.smoke.js` | New M6 acceptance suite |
| `tests/browser-rfq.smoke.js` | M5 expects frontend duplicate validation; existing save/recovery assertions retained |
| `tests/browser-rates-ux.smoke.js` | M5 explicitly confirms common-key replacement |
| `tests/browser-xlsx.smoke.js` | M5 explicitly confirms source replacement when the form is populated |
| `tests/browser-ai.smoke.js` | M5 accepts explicit populated-form replacement review |
| `tests/browser-ai-association.smoke.js` | Same replacement interaction; association assertions retained |
| `tests/browser-m2.smoke.js` | Same replacement interaction; contrast/focus/zoom assertions retained |
| `tests/browser-visual-v2.smoke.js` | Same replacement interaction; existing workflow assertions retained |
| `tests/run-browser-suites.js` | Adds M5/M6 to the 17 accepted suites (19 total) |
| `docs/current-status.md` | Completion/evidence and owner-review stop |
| `docs/learning-log.md` | Validation, identity, request ownership and review lessons |
| `docs/decisions/0025-manual-intake-validation-identity.md` | M5 decision |
| `docs/decisions/0026-source-review-application.md` | M6 decision |
| `tasks/m5-m6-intake-review.md` | Authorized scope, sequential gates and checkpoints |
| `docs/m5-m6-handoff.md` | This handoff |

`EvidenceSource.jsx` required no modification: its existing safe rendering, strict evidence slicing and deliberate focus/return behavior are reused. No backend files, financial fixtures or package files changed.

## Final verification

| Command/gate | Exact result | Evidence |
| --- | --- | --- |
| `node --test tests/intake-validation.test.js tests/intake-review.test.js tests/m1-state.test.js tests/register-view.test.js tests/ui-format.test.js tests/ui-evidence.test.js` | 19 passed, 0 failed/skipped | `.tmp/m6-unit.log` |
| `npm.cmd test` | 90 passed, 0 failed/skipped | `.tmp/m6-api-unit.log` |
| `npm.cmd run test:costing` | 33 passed, 0 failed/skipped; all nine existing goldens unchanged | `.tmp/m6-costing.log` |
| `node .tmp/t06-run.mjs .tmp/m5-m6-db.mjs` | Unchanged `test:db` Node test list: 137 passed, 0 failed/skipped; child exit 0 | `.tmp/m6-database.log` |
| `npm.cmd run check:api` | 47 API/maintenance modules passed | `.tmp/m6-syntax.log` |
| `node .tmp/t06-run.mjs tests/browser-m5.smoke.js` | Passed independent M5 gate; repeated in complete regression | `.tmp/m5-focused.log` |
| `node .tmp/t06-run.mjs tests/browser-m6.smoke.js` | Passed independent M6 gate; repeated with stable-target checks and in complete regression | `.tmp/m6-focused.log` |
| `node .tmp/t06-run.mjs tests/run-browser-suites.js` | All 19 suites passed; process exit 0 | `.tmp/m6-all-browser.log` |
| `npm.cmd run build` | Passed, 56 modules | `.tmp/m6-build.log` |
| `npm.cmd run test:production` | 1 passed, 0 failed/skipped; actual production child serves React/assets/liveness and honestly reports unavailable DB in this intentionally DB-disconnected startup test | `.tmp/m6-production.log` |

The 19 suites are auth, quotation, rfq, ai, xlsx, ai-association, lifecycle, pdf, rates-ux, final-workflows, ui, version-consistency, visual-v2, m1, m2, m3, m4, m5 and m6. Both Estimator and Sales Head flows pass, including role denial, saved input review, immutable snapshots, exact lost-response recovery and issuance. M2 retains actual keyboard/focus checks, computed text contrast/35 palette combinations, reduced motion and real Chrome 200%/400% host zoom. New intake/matrix/source checks cover 1440×1000, 768×1024, 390×844 and 320×844; no page-level horizontal overflow. Wider tablet/desktop tables retain named keyboard scrolling.

The ignored local-only wrapper privately verifies localhost maintenance configuration, creates a random disposable `_test` parent and overrides all child DB variables. Browser fixtures additionally use dedicated disposable local databases. `.tmp/m5-m6-db.mjs` executes the exact unchanged package `test:db` Node test list without the older npm shell bridge. An initial bridge run passed all 137 tests but emitted Node's shell deprecation warning; the final shell-free run confirms exit 0. Initial sandboxed esbuild traversal failed; the same build succeeded with the approved local build sandbox escalation. No application change was made to bypass either environment issue.

## Actual screenshots and visual inspection

38 curated PNGs, source paths and SHA-256 hashes: [screenshot manifest](../.tmp/m5-m6-review/screenshots.json). The two accepted-before references come from preserved M3/M4 curated artifacts; final captures come from the actual final regression build. They are browser screenshots, not mockups.

| Review | Desktop/tablet | Mobile |
| --- | --- | --- |
| M5 single-part inputs | [1440](../.tmp/m5-m6-review/m5-single-part-1440.png), [768](../.tmp/m5-m6-review/m5-single-part-768.png) | [390](../.tmp/m5-m6-review/m5-single-part-390.png), [320](../.tmp/m5-m6-review/m5-single-part-320.png) |
| M5 inline validation/summary | [1440](../.tmp/m5-m6-review/m5-validation-1440.png) | [390](../.tmp/m5-m6-review/m5-validation-390.png) |
| M5 matrix | [1440](../.tmp/m5-m6-review/m5-matrix-1440.png), [768](../.tmp/m5-m6-review/m5-matrix-768.png) | [390](../.tmp/m5-m6-review/m5-matrix-390.png), [20 parts at 320](../.tmp/m5-m6-review/m5-twenty-matrix-320.png), [accepted-before 320](../.tmp/m5-m6-review/accepted-before-matrix-320.png) |
| M6 Gemini source/evidence | [1440](../.tmp/m5-m6-review/m6-gemini-evidence-1440.png) | [320](../.tmp/m5-m6-review/m6-gemini-evidence-320.png), [accepted-before 390](../.tmp/m5-m6-review/accepted-before-gemini-390.png) |
| M6 individual apply | [768](../.tmp/m5-m6-review/m6-individual-apply-768.png) | [390](../.tmp/m5-m6-review/m6-individual-apply-390.png) |
| M6 Excel cell review | [1440](../.tmp/m5-m6-review/m6-excel-review-1440.png), [768](../.tmp/m5-m6-review/m6-excel-review-768.png) | [390](../.tmp/m5-m6-review/m6-excel-review-390.png), [320](../.tmp/m5-m6-review/m6-excel-review-320.png) |
| Downstream regression | [Annual comparison](../.tmp/m5-m6-review/downstream-comparison-1440.png), [400% costing](../.tmp/m5-m6-review/downstream-costing-zoom-400.png) | [Working inputs](../.tmp/m5-m6-review/downstream-working-inputs-390.png), [Sales Head inputs](../.tmp/m5-m6-review/downstream-sales-inputs-320.png), [Rate authoring](../.tmp/m5-m6-review/downstream-rate-author-390.png), [Issuance](../.tmp/m5-m6-review/downstream-issuance-320.png) |

Personally inspected desktop, tablet and narrow intake, validation, matrix, Gemini evidence/application and Excel review, plus downstream saved scenarios, Sales Head inputs, rate authoring and issuance. Visual review corrected readiness counts that previously described invalid nonempty values as complete. Narrow matrix controls now use the same full-width native selects; evidence wraps without losing exact source text. The accepted charcoal/forest/ivory/crimson identity remains.

## Limitations and owner review

- Ordinary unsent drafts retain M1's authenticated-tab memory lifetime. Navigation preserves them; sign-out, session expiry, forced unload/crash can discard them. Existing beforeunload protection and durable submitted-intent recovery remain. No new persistence of source, file contents or evidence.
- Removal undo restores the most recently removed part, up to the 20-part limit. It is not a general edit history. Replacement confirmation protects populated inputs; no new autosave or draft backend exists.
- Twenty-part documents and field-by-field evidence reviews remain long. Component jumps, row review, source highlighting and explicit application improve access; no virtualization/wizard or second form state model was introduced.
- Desktop/tablet matrix labels can truncate long codes inside native selects; full selected code/unit remains in the title and native option list. Tablet tables intentionally scroll horizontally within named regions; page overflow checks pass. Phones stack the same matrix controls.
- Verified extraction means server schema/evidence verification, not human approval or guaranteed document correctness. Final human review remains necessary. Missing/uncertain fields require manual correction; customer material never assigns internal keys.
- Gemini is mocked in automated acceptance; live provider connectivity is not claimed or exercised. Browser evidence uses installed Chrome; Safari/Firefox, physical devices and assistive-technology user testing were not performed.
- Application code and tests are ready for owner review. No deployment or production operation is authorized by completion.

## Rollback instructions

No rollback was executed. Do not reset to HEAD: that would destroy accepted uncommitted M1–M4 work. Do not use older milestone checkpoints.

1. Preserve any newer owner edits first. Read `.tmp/m5-m6-review/changed-files.json` and the relevant checkpoint manifest; compare current hashes before restoring anything.
2. To undo both milestones, copy back only existing files changed by this assignment from `.tmp/m5-m6-before`. Remove only assignment-created files listed in the manifest, after checking for later edits. Preserve all unrelated files and earlier accepted changes.
3. To undo M6 while retaining independently verified M5, restore only M6-modified existing files from `.tmp/m5-verified-before-m6` and remove only M6-created files. This also rolls back the dialog focus-return correction added during M6. Reconcile status/learning/handoff documentation to describe the retained milestone; M5 documentation was written during the final combined handoff.
4. Rebuild with `npm.cmd run build` and run the retained milestone's tests. No database rollback, migration, seed, password change or API rollback is required.

Example single-file restoration, **not executed**:

```powershell
Copy-Item -LiteralPath '.tmp/m5-verified-before-m6/apps/web/src/RfqExtraction.jsx' -Destination 'apps/web/src/RfqExtraction.jsx'
```

Use the complete phase manifest when restoring, since shared imports/styles must be rolled back coherently. Ignored checkpoint/review directories are local artifacts; retain them for owner review.

## Three owner understanding questions

1. Why does a missing current effective rate warn during intake while an actual historical rate gap blocks costing?
2. Why must a frozen RFQ retry reuse its recorded body/key instead of validating against newly edited inputs or a refreshed catalogue?
3. What distinguishes server-verified evidence, explicit application to a selected manual part, final human review and server-confirmed RFQ persistence?

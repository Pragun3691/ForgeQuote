# ADR-0019 - Tier 2 intake review and issuance controls

Owner approved implementation on the existing feature/forgequote-ui-redesign branch on November 8, 2026, after accepting the Tier 1 visual refinement. Order: matrix, Gemini evidence, Sales Head saved inputs, issuance confirmation. Test each independently, then run complete regression/screenshots. No backend/API/schema/dependency change, financial calculation, proportional chart, commit, push, merge or deployment.

## Matrix is another view of the existing form

Single-part RFQs retain their original selectors. Multiple parts use one semantic table containing six native required selects per row. RfqCreate still owns form.parts[].rateKeys and uses the same partChange/change handlers; there is no second assignment state or altered request body. Native fieldset disabling covers saving, uncertain recovery, extraction/import, storage failure and unavailable keys. Suggestions and copying remain deliberate actions; every edit/copy/apply clears estimator confirmation. No inference or automatic rate selection. Existing keys and category filtering come from the existing catalogue response. Missing keys/history remain errors/warnings, never zero rates. Sticky row headers and ScrollTable retain mobile/keyboard context.

## Source offsets and highlighting

The existing server verifier (ai/evidence.js) uses JavaScript indexOf, string length and accumulated line lengths. Its offsets are zero-based UTF-16 code units, end exclusive. It strips a trailing CR only for line parsing, while offsets retain the original source length. Unit tests call the actual verifier with an emoji/variation selector, accented text and CRLF, then check each returned span against JavaScript slice. This validates the convention without changing the backend.

The browser captures the exact submitted source in transient React state. It does not trim, normalize, persist or log this source. Editing source clears results/selection and resets both consent checkboxes as before. A highlight requires found=true, inScope=true, integer bounded offsets, nonempty quote and exact source.slice(start,end)===quote. Invalid evidence remains a visible quote with a highlight-unavailable explanation; no search/fuzzy fallback is allowed. React renders source text safely rather than interpreting HTML. The selected source reference moves focus to the source pane, with an explicit Return to field action. Desktop uses a sticky split view; mobile stacks the panes and reveals source below navigation. Intake allows sticky positioning rather than clipping it; tables retain independent bounds. Geometry assertions verify heading/mark visibility. Explicit htmlFor/id keeps the textarea's accessible label independent of its entered text.

Highlighting means a located quote, not approval or correctness of its fact. Existing server field statuses, warnings, source review, explicit Apply, manual key selection and final estimator confirmation remain authoritative. Provider/schema/association/extraction logic is unchanged; no confidence score is invented.

## Sales Head saved inputs

Replace disabled default-input controls with a semantic summary sourced only from the selected snapshot: saved pricing date/version, routing revision/ID, exact margin/cycle/setup strings and each saved tier annual quantity. Live RFQ facts remain separate. With no saved version, prompt selection; during loading, do not substitute defaults. Existing form state/recovery and estimator UI are retained. Existing results/provenance/internal PDF supply the remaining saved information. A browser test proves a saved 1,000-unit baseline is shown while the RFQ's own quantity remains 180,000; direct Sales Head draft POST is still denied.

## Issuance confirmation

Only the existing eligible estimator action opens a native modal dialog bound to the selected immutable snapshot. Show its reference/customer/version/pricing date/saved ex-GST annual value, explain issuance/new-version semantics and server revalidation. No issuance number is fabricated. Opening/Cancel/Escape/navigation sends no POST and creates no key. Cancel receives initial focus; native modality makes the background inert, explicit Tab/Shift+Tab wrapping keeps both buttons in the cycle, and cancellation returns focus to the trigger. The expanded browser test exposed a native last-button Tab escape before this explicit wrapping was added.

Confirm invokes the unchanged act('issue') path. A synchronous ref guard prevents two confirmation events within the same React batch from generating two attempts; busy state alone failed that deliberate browser regression. Existing exact-key sessionStorage recording, server eligibility/approval/locking and uncertain-response retry remain unchanged. Recovery retries an already confirmed request directly. Dialog state clears when known eligibility is lost; selecting another version unmounts its component. No automatic POST retry or altered approval/issuance rule is added.

## Review boundaries

All values remain persisted decimal strings; no new monetary arithmetic or chart normalization. Fonts/tokens, copper action semantics, disclosures, role boundaries and PDFs remain unchanged. Test evidence and exact file delta are in docs/ui-tier2-handoff.md. Changes remain uncommitted for owner review.

## Final selected-version consistency correction

Owner approved Tier 2 visuals subject to investigating a Version 1 selector beside Version 2 results. This was a genuine stale navigation-metadata bug: same-RFQ hash navigation fetched the selected immutable snapshot but the RFQ/version list loaded only on RFQ identity change. Another session/test actor could append version 2 after that initial read, leaving only version 1 in the selector indefinitely. The financial panels in the reported capture correctly shared version 2; its RFQ metadata was stale.

Workspace now reads the selected immutable version, then refreshes existing RFQ metadata and verifies the version is listed before exposing the saved panels. Metadata refresh never reinitializes estimator form/pending state. A monotonically ordered read token prevents an older RFQ response from replacing newer metadata; abort guards prevent abandoned version responses from applying. All saved panels additionally require snapshot.versionId to match the current rendered target immediately, before effects clear old state. Lifecycle remains keyed by that same snapshot ID. Clearing selection clears loading correctly. Existing APIs and immutable snapshot/event rules are unchanged.

The new real-browser/disposable-PostgreSQL test reproduces the one-item stale selector before the fix, then covers both roles, late metadata/snapshot/lifecycle responses, rapid history switching, exact golden financial/input values, no mixed selector/panel renders, unsaved estimator inputs, unchanged saved snapshots and zero quotation writes during navigation. Details/captures: docs/version-consistency-handoff.md.

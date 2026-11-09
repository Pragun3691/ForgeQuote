# ADR-0024 - working estimate and selected immutable quotation

Owner approved M4 as the second part of the combined M3/M4 assignment. M3's final 16-suite gate passed before .tmp/m3-accepted-before-m4 captured its 236-file checkpoint. M1/M2/M3 remain in force.

## State stays with its owner

RfqWorkspace retains RFQ reads, monotonic/abort/version guards, ordinary memory drafts, pending-record inspection, exact body/key recording, submit/start-new handlers and known-success invalidation. CostingInputs is controlled presentation with the same field names, values, patterns and callbacks. Its legacy flat-body view does not reshape the pending request. No pricing, arithmetic, rounding, rate selection or authorization moves into the browser.

Editable working inputs explicitly state that a new saved quotation requires server confirmation. Saving/uncertain records identify the unresolved attempt and lock inputs for existing same-key recovery. Only the recorded saved phase presents server-confirmed submitted inputs; its version link uses the known receipt ID and available real metadata. That submission remains distinct from whichever historical snapshot the user selects. No autosave/crash-recovery promise or new durable storage.

## Navigation and review

SavedVersionNav shows the selected snapshot's version, pricing date and saved timestamp with native existing version links in a bounded horizontal rail. Neutral/loading/failed read text is resource-specific. It never automatically selects a newer version or focuses after a background read. Existing selectedSnapshot guards control every financial panel; metadata refresh cannot substitute working defaults or another snapshot.

Section/part jumps are explicit type=button actions that focus/scroll existing content without changing the RFQ/version hash, submitting or unmounting forms. Unavailable input sections have no nonfunctional jump control. Sales Head sees read-only selected-snapshot summaries and the original full input table. On small screens a saved-part jump targets its visible summary; desktop targets its table row.

## Financial presentation

The saved annual baseline and lifecycle remain beside the selected-version context. Annual three-scenario totals appear before per-part breakdowns. Narrow screens get summaries from the same persisted totals, with annual subtotal ex-GST, annual illustrative GST and annual total including GST explicitly labeled. Full semantic comparison tables remain available in named keyboard-scrolling regions. Per-part headline selling price, manufacturing cost and breakdown are labeled per-unit ex-GST; saved quantities state units/year. Rate provenance retains exact resolved strings, physical units, effective starts and immutable rate-version IDs. Formula/version/GST disclosures remain.

The 100% headline is selected by its scenario key. No monetary summation, conversion to Number, quote-to-quote delta, chart normalization or current-rate join is introduced. Source values remain the selected snapshot's exact decimal strings; existing formatting is unchanged. Small-screen summaries are presentation adapters, not another financial data source. Results and saved-input views sort copies of the saved part array by part number; they do not mutate the snapshot or recorded body. At 320px, annual amounts occupy full-width value rows to keep their decimal digits intact.

No backend, schema, endpoint, package/dependency, financial policy, authentication, CSRF, server authorization, immutable snapshot, idempotency, issuance-modal or PDF behavior changes. Complete tests, screenshots, limitations and both rollback boundaries: docs/m3-m4-handoff.md. Stop after M4 for owner review; no M5, commit, push, merge or deployment.

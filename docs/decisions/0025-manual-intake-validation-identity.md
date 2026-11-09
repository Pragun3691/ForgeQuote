# ADR-0025: Manual intake validation and stable part identity

Status: implemented under the owner's combined M5/M6 approval, 2026-11-09.

The manual form previously relied on native patterns and server rejection. Its quantity pattern allowed values above the server maximum, decimal patterns permitted zero weight/cycle time, whitespace-only text passed browser checks, and duplicate part numbers were detected only after submission. Index keys reused surviving inputs after removal.

Use a small frontend validation helper mirroring `apps/api/src/rfq-intake.js` and `quotation-request.js`. Test acceptance against the actual backend canonicalizer as well as explicit documented boundaries. Text validation uses trimmed length without rewriting the draft. Duplicate part numbers are trimmed and case-sensitive. Decimal validation uses strings, quantity bounds use BigInt, and no money arithmetic is introduced. Dates use the same format and ISO round-trip checks. Rate IDs must exist in their category; the absence of a current effective rate is a warning, not an intake prohibition.

Keep form ownership, exact recorded request bodies and persist-before-POST recovery in RfqCreate. Frozen same-key retries bypass new draft validation and reuse their original body/key. UI-only UUIDs identify parts and matrix rows; they never enter API bodies or submission storage. Stable identities survive removal and one-step undo. Controlled presentation extraction does not own or reset draft state.

Show inline errors after blur or a deliberate save attempt, with stable accessible labels, linked descriptions and a focusable error summary. Component readiness counts include invalid values, not only blanks. Preserve the existing final human-review checkbox and reset it after edits. Use the same six native controlled selects in a desktop table and stacked mobile rows, retaining names and table semantics without hidden duplicate controls.

Removal is reversible with an explicit undo action. Bulk key/source replacement of populated inputs requires a native modal with Escape, initial safe focus and explicit trigger-focus restoration. No stay/discard prompt is added to internal navigation because M1 retains the draft. Ordinary unsent draft lifetime remains authenticated-tab memory; this milestone does not promise crash persistence.

No backend, API, schema, financial, authorization, dependency or deployment change. Relevant evidence: intake-validation unit tests, M5 browser suite, existing RFQ recovery/rates/M1 suites and docs/m5-m6-handoff.md.

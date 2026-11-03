# T03 - Complete multipart quotation integration

Owner approved the six-point plan and explicitly authorized implementation/testing/commit on feature/T03-multipart-quotations from d29d2b5. An interrupted run left three partial backend edits; recovery inspected and preserved all of them. No new approval checkpoint.

## Scope and contract

- HTTP supports 1-20 explicit part entries with stable IDs; exact RFQ coverage independent of ordering. No omitted, duplicate or foreign parts; selected routing revision must belong to its part and all effective rates must exist.
- Preserve flat single-part requests, canonical fingerprints, saved versions and exact pending bodies/keys. New multipart canonicalization sorts normalized IDs. Pricing date is shared; each part has routing, margin and three decimal/integer-string quantity inputs.
- Reuse the unchanged costing engine, all-part persistence service, one transaction and actor/key receipt. Calculate each part separately; combine rounded unit-price lines and calculate quotation GST using the existing policy. One immutable version contains every part/rate/scenario and combined totals.
- Compact repeated controls in the existing workspace, one calculate/save action, per-part prices/three scenarios and shared totals. Explicit saved baseline annual value excluding GST; no approval behavior.
- Quotation POST alone gains a bounded 64 KiB allowance; existing RFQ/extraction allowances and ordinary 4 KiB limits/security remain.

## Verification gates and stop

Real PostgreSQL two/three-part fixtures, nine unchanged goldens, complete snapshots, exact ID coverage, routing/rate/input failures, atomic storage rollback, concurrent reordered retries, conflicts, immutable history and lost COMMIT recovery. Real Chrome single/legacy/two/three-part save/reopen/refresh, uncertain-response recovery, reordered controls, read-only sales head and mobile display. Full unit/costing/database/browser, syntax, build and startup gates. Disposable fixtures only; no development data/ownership/grants operations.

Contract: ADR-0012. Results/manifest/known limits: docs/t03-handoff.md. No migration, engine/golden edit, approval/PDF, unrelated redesign, dependency, push or deployment. STOP after focused commit.

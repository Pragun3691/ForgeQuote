# Brief-to-build traceability

**Source provenance:** This document records the earlier interpretation of user-supplied IsoCode Labs client brief screenshots. The original screenshots/brief are not present in the tracked repository, so direct verification of the requirement wording, core/optional classifications and submission instructions below is **UNVERIFIED** pending comparison with the original. Implementation/test evidence is separate from verification of the assignment source. Accepted owner-approved costing and ADR policies remain unchanged; do not describe implementation assumptions as confirmed client rules.

| ID | CORE requirement | How to prove it | Status |
|---|---|---|---|
| R1 | Estimator & sales-head roles | Demo sign-in + server authZ tests | Implemented/tested for demo roles; Sales Head approval/rejection in T04; costing remains estimator-only |
| R2 | RFQ register with customer, due date, owner, status | Create/list/update RFQ and persistence test | Manual 1-20 part create/list/detail; assigned estimator and issuance-derived estimating/sent; Sales Head append-only terminal won/lost with lost reason implemented/tested locally |
| R3 | RFQ intake AI extraction | Upload synthetic PDF/text, inspect evidence, confirm/correct | T02.2 pasted-text SDK/review/evidence path implemented and mock-provider/real-DB/Chrome tested; real synthetic Gemini extraction verified; deterministic Excel part-list import/review/save verified; numbered SP-101/BR-202 association finding corrected and real-provider/Chrome verified (part-association handoff); RFQ PDF intake pending |
| R4 | Part costing, 2–3 volume prices | Golden tests for 3 parts × 3 tiers | T03 complete 1-20-part HTTP/React quotation integration; real two/three-part workflows, combined scenario totals and nine unchanged goldens verified; T04 approval/issuance and T05 customer PDF verified locally |
| R5 | Effective-dated rate masters | Boundary tests, no overlapping rates, missing rate failure | Catalogue/history plus Sales Head append-only rate versions, reason/author, six-place decimal validation, forward-only Asia/Kolkata starts and concurrent retry protection implemented/tested locally; 007 release pending |
| R6 | Old quotes preserve historical rates | Issued quote unchanged after rate update | Immutable snapshots plus T04 issuance/event history verified locally |
| R7 | Sales-head approval for annual value > ₹25,00,000 | Threshold tests; unauthorized bypass rejected | T04 strict stored-baseline threshold, roles, concurrency/stale versions and Chrome workflow verified locally; cloud migration pending |
| R8 | Customer quotation PDF with selling prices & GST separately (T05 owner scope) | Download and compare PDF to saved snapshot | T05 issued/current-only A4 PDF, saved three-scenario prices/totals, embedded rupee fonts, confidential-field exclusion and both-role browser download verified locally |
| R9 | Professional responsive UI | No dead actions; loading/empty/error states | Essential RFQ/costing states verified in Chrome desktop/mobile; T06 intake summaries/evidence collapse/key actions/keyboard/mobile verified; broader visual polish pending |
| R10 | Tests, demo data, documentation & deployment | Fresh setup, public repo, TDD link, demo credentials | Local tests/fixtures/docs through T06; owner reports T01-T05 deployed and live approval/issuance/PDF manual checks passed; T06 release and submission pending |

**Optional depth, ONLY after full core:** historical Excel quotation import (~1,400 rows), historical search, similar-part route suggestions.

**Out of scope:** CAD/3D analysis, live ERP integration, supplier portal.

**Submission:** ZIP ≤25MB with a TDD (PDF or Word) and `deployment.md`; TDD includes GitHub URL at top and deployed URL if applicable. Public repository stays accessible for review. External deadline Nov 9, 2026 23:59 IST.

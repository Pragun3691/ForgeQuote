# Brief-to-build traceability

**Source provenance:** This document records the earlier interpretation of user-supplied IsoCode Labs client brief screenshots. The original screenshots/brief are not present in the tracked repository, so direct verification of the requirement wording, core/optional classifications and submission instructions below is **UNVERIFIED** pending comparison with the original. Implementation/test evidence is separate from verification of the assignment source. Accepted owner-approved costing and ADR policies remain unchanged; do not describe implementation assumptions as confirmed client rules.

| ID | CORE requirement | How to prove it | Status |
|---|---|---|---|
| R1 | Estimator & sales-head roles | Demo sign-in + server authZ tests | Implemented/tested for demo roles; sales head read-only in T01 |
| R2 | RFQ register with customer, due date, owner, status | Create/list/update RFQ and persistence test | T02.1 manual 1-20 part create/list/detail tested; server-owned owner/status; RFQ update pending |
| R3 | RFQ intake AI extraction | Upload synthetic PDF/text, inspect evidence, confirm/correct | T02.2 pasted-text SDK/review/evidence path implemented and mock-provider/real-DB/Chrome tested; live provider NOT RUN (no key); Excel/PDF pending |
| R4 | Part costing, 2–3 volume prices | Golden tests for 3 parts × 3 tiers | Nine unchanged goldens; one-part HTTP/React three-tier workflow verified |
| R5 | Effective-dated rate masters | Boundary tests, no overlapping rates, missing rate failure | Backend history/resolution tested; management UI pending |
| R6 | Old quotes preserve historical rates | Issued quote unchanged after rate update | Immutable draft snapshots verified; issuance pending |
| R7 | Sales-head approval for annual value > ₹25,00,000 | Threshold tests; unauthorized bypass rejected | Planned |
| R8 | Quote PDF with costs & GST separately | Download and compare PDF to saved snapshot | Planned |
| R9 | Professional responsive UI | No dead actions; loading/empty/error states | Essential RFQ/costing states verified in Chrome desktop/mobile; dedicated polish pending |
| R10 | Tests, demo data, documentation & deployment | Fresh setup, public repo, TDD link, demo credentials | Local tests/fixtures/docs complete through M7; deployment/submission pending |

**Optional depth, ONLY after full core:** historical Excel quotation import (~1,400 rows), historical search, similar-part route suggestions.

**Out of scope:** CAD/3D analysis, live ERP integration, supplier portal.

**Submission:** ZIP ≤25MB with a TDD (PDF or Word) and `deployment.md`; TDD includes GitHub URL at top and deployed URL if applicable. Public repository stays accessible for review. External deadline Nov 9, 2026 23:59 IST.

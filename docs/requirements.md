# Brief-to-build traceability

**Source:** User-supplied IsoCode Labs client brief screenshots. Do not describe implementation assumptions as confirmed client rules.

| ID | CORE requirement | How to prove it | Status |
|---|---|---|---|
| R1 | Estimator & sales-head roles | Demo sign-in + server authZ tests | Planned |
| R2 | RFQ register with customer, due date, owner, status | Create/list/update RFQ and persistence test | Planned |
| R3 | RFQ intake AI extraction | Upload synthetic PDF/text, inspect evidence, confirm/correct | Planned |
| R4 | Part costing, 2–3 volume prices | Golden tests for 3 parts × 3 tiers | Spec drafted |
| R5 | Effective-dated rate masters | Boundary tests, no overlapping rates, missing rate failure | Planned |
| R6 | Old quotes preserve historical rates | Issued quote unchanged after rate update | Planned |
| R7 | Sales-head approval for annual value > ₹25,00,000 | Threshold tests; unauthorized bypass rejected | Planned |
| R8 | Quote PDF with costs & GST separately | Download and compare PDF to saved snapshot | Planned |
| R9 | Professional responsive UI | No dead actions; loading/empty/error states | Planned |
| R10 | Tests, demo data, documentation & deployment | Fresh setup, public repo, TDD link, demo credentials | Planned |

**Optional depth, ONLY after full core:** historical Excel quotation import (~1,400 rows), historical search, similar-part route suggestions.

**Out of scope:** CAD/3D analysis, live ERP integration, supplier portal.

**Submission:** ZIP ≤25MB with a TDD (PDF or Word) and `deployment.md`; TDD includes GitHub URL at top and deployed URL if applicable. Public repository stays accessible for review. External deadline Nov 9, 2026 23:59 IST.

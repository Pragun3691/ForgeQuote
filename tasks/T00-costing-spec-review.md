# T00 — Costing policy review (NO application coding)

**Goal:** Lock an internally consistent, client-traceable demo financial contract before the database schema or costing engine is implemented.

1. Read `docs/costing-spec.md`, especially the distinction between client requirements and our demo assumptions.
2. Verify the spindle 100% golden case by hand: each rounded cost line, setup allocation, selling price, and annual value. It should be **₹119.76 cost/unit; ₹149.70 selling price/unit; ₹2,69,46,000.00 annual value**, under v0.2 proposed setup-hours assumptions.
3. Compare the updated nine cases against `docs/golden-cases.md`. Cross-check at least one other case and the multi-part total.
4. Ensure approval compares the **whole quotation**, not each part; exactly ₹25 lakh vs one paisa above; new versions cannot inherit earlier approval.
5. Review `docs/decisions/0001-stack.md` separately; do not silently accept it while approving costing.
6. Confirm pricing date policy, missing/overlapping rate behavior, GST-demo simplification, batch policy and below-threshold handling.
7. Record your own short explanations in `docs/learning-log.md`: Why divide by (1-margin)? Why freeze issued quotes? Why sum parts? Why round cost lines before price?
8. Only once review passes: set `Status: ACCEPTED` in ADR-0002; commit the spec changes to `feature/T00-costing-policy`. Do not implement T01 before the policy is accepted.

**Exit gate:** Candidate can explain a complete calculation and its assumptions, effective-dated rates, immutability, per-quotation ₹25 lakh boundary, and how to test failures.

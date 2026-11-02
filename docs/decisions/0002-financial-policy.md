# ADR-0002 — Financial, versioning and approval policies

- **Status: ACCEPTED — T00 verification completed on 2026-11-02.**
- **Client rules:** deterministic costing (never AI), volumes, effective-dated masters, GST shown separately, approval for annual quotation value **exceeding ₹25,00,000**.
- **Chosen proposed demo assumptions:**
  1. Margin is gross margin on selling price; `price = rounded_cost / (1 - margin)`, with `0 <= margin < 100%`.
  2. Round per-unit money lines HALF_UP to paise, sum those lines, then round the selling price from the total. Taxable totals and GST round separately.
  3. GST is one configurable quote-specific percentage, saved in the immutable snapshot, not a full CGST/SGST/IGST calculation.
  4. Default volume tiers 50% / 100% / 150% (editable), 100% tier headline; use at most 12 batches/year by default, integer units split among batches; no quantity-dependent raw material discounts.
  5. Setup cost is derived from routing revision `setup_hours_per_batch × effective_machine_hour_rate`, then allocated as `setup_cost_per_batch × batch_count / tier_annual_units`. The sample parts use 12 batches.
  6. Each costing version fixes a `pricing_date` at creation (Asia/Kolkata business date); rates effective on that date selected from start-inclusive/end-exclusive nonoverlapping periods. Changing inputs or recalculating creates a **new version**; issued snapshots remain immutable.
  7. Approval basis is **the sum across all parts** of 100%-tier rounded unit price × each part's requested annual quantity, before GST. Evaluate on backend at submission. Strictly greater than ₹25 lakh needs sales-head approval for the exact version; equality does not.
  8. Below/equal-threshold quotes may be issued by estimator with audit `approval_basis=below_threshold`; this workflow is an assumption, not a client rule.
- **Why:** Reproducible financial outputs, auditable history, meaningful role enforcement, testable exact approval boundaries, and a strict AI/non-AI divide.
- **Trade-offs:** The real manufacturer may use alternative scrap/overhead bases, tax splits, margin definitions, quantity pricing, or approval gates. Deliberately narrow take-home assumptions must be disclosed in the TDD, and not claimed as approved operational policy.
- **Verification:** Independent 9 golden tier cases in `docs/golden-cases.md`, multi-part approval/threshold tests, rate boundary/mutation tests, and candidate's hand verification of one full case.

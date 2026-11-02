# Golden costing cases v0.2 — independent expectations (APPROVED - ADR-0002)

**IMPORTANT:** The original client sample provides part, material, gross weight, stated annual quantity, cycle time and machine-hour rate. The numeric material rates, scrap/overhead percentages, packaging, freight, setup HOURS, margins, and tier/batch policy below are **illustrative TEST ASSUMPTIONS** we must document in the TDD. These replace v0.1 fixed setup-rupees-per-batch fixtures. Never change a golden value merely to match app output.

## 1. Fixture inputs

| RFQ / part | Material | Kg/part | Material ₹/kg | Cycle min | Machine ₹/hour | Scrap % | Overhead % | Pack ₹ | Freight ₹ | **Setup hours/batch** | Margin % | Requested annual qty |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| RFQ-2611-014 / Rear-wheel spindle | EN8 | 0.61 | 100 | 3.2 | 850 | 2 | 10 | 3 | 4 | 12 | 20 | 180,000 |
| RFQ-2611-019 / Hydraulic lift arm | 40Cr4 forging | 4.60 | 130 | 11.5 | 1450 | 3 | 12 | 12 | 16 | 24 | 18 | 24,000 |
| RFQ-2611-023 / Gear blank | 20MnCr5 | 1.48 | 165 | 4.8 | 950 | 2.5 | 11 | 7 | 9 | 18 | 22 | 60,000 |

Use a fixture pricing date of **2026-11-02** and corresponding non-overlapping effective rates. Each golden part is one operation with the listed setup hours per batch. The machinery rate also prices its setup time.

## 2. Exact expected outputs (three parts × three tiers)

| RFQ | Tier | Annual units in tier | Batches | Approx lot size | Setup ₹/unit | Total cost ₹/unit | Selling price ex-GST ₹/unit |
|---|---:|---:|---:|---:|---:|---:|---:|
| RFQ-2611-014 | 50% | 90,000 | 12 | 7,500 | 1.36 | 120.44 | 150.55 |
| RFQ-2611-014 | 100% | 180,000 | 12 | 15,000 | 0.68 | 119.76 | 149.70 |
| RFQ-2611-014 | 150% | 270,000 | 12 | 22,500 | 0.45 | 119.53 | 149.41 |
| RFQ-2611-019 | 50% | 12,000 | 12 | 1,000 | 34.80 | 990.01 | 1207.33 |
| RFQ-2611-019 | 100% | 24,000 | 12 | 2,000 | 17.40 | 972.61 | 1186.11 |
| RFQ-2611-019 | 150% | 36,000 | 12 | 3,000 | 11.60 | 966.81 | 1179.04 |
| RFQ-2611-023 | 50% | 30,000 | 12 | 2,500 | 6.84 | 357.51 | 458.35 |
| RFQ-2611-023 | 100% | 60,000 | 12 | 5,000 | 3.42 | 354.09 | 453.96 |
| RFQ-2611-023 | 150% | 90,000 | 12 | 7,500 | 2.28 | 352.95 | 452.50 |

## 3. Full 100% cost breakdowns

| Part | Material | Machining | Scrap | Overhead | Packaging | Freight | Setup | Total cost | Selling price ex-GST | Annual quote value ex-GST |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Rear-wheel spindle | 61.00 | 45.33 | 1.22 | 4.53 | 3.00 | 4.00 | 0.68 | 119.76 | 149.70 | 26,946,000.00 |
| Hydraulic lift arm | 598.00 | 277.92 | 17.94 | 33.35 | 12.00 | 16.00 | 17.40 | 972.61 | 1186.11 | 28,466,640.00 |
| Gear blank | 244.20 | 76.00 | 6.11 | 8.36 | 7.00 | 9.00 | 3.42 | 354.09 | 453.96 | 27,237,600.00 |

### Hand-auditable spindle walkthrough (100% tier)

- Material: 0.61 kg × ₹100/kg = **₹61.00**.
- Machining: 3.2 min ÷ 60 × ₹850/hour = ₹45.333333… ⇒ **₹45.33**.
- Scrap: 2% × ₹61.00 = **₹1.22**.
- Overhead: 10% × ₹45.33 = ₹4.533 ⇒ **₹4.53**.
- Packaging + freight: **₹3.00 + ₹4.00**.
- Setup: 12 hours/batch × ₹850/hour = ₹10,200/batch; 12 batches × ₹10,200 ÷ 180,000 units = **₹0.68**.
- Rounded-line sum: 61.00 + 45.33 + 1.22 + 4.53 + 3.00 + 4.00 + 0.68 = **₹119.76**.
- Selling price at 20% gross margin: ₹119.76 ÷ 0.80 = **₹149.70**.
- Annual value: ₹149.70 × 180,000 = **₹2,69,46,000.00**. Requires sales-head approval.

### Multi-part example

If one RFQ contains all three sample parts at their stated annual volumes, the approval base is the **sum** of the three 100%-tier annual values, regardless of each part’s individual amount.

- Annual combined value ex-GST = **₹82,650,240.00**; sales-head approval is mandatory.

## 4. Independent approval-boundary tests (separate from these three fixtures)

- Quotation annual value **₹25,00,000.00** → no sales-head approval required.
- Quotation annual value **₹25,00,000.01** → approval required.
- Four parts with values **₹15 lakh each** on the same quote → **₹60 lakh** total → approval required (guards against per-part checking).
- Recompute threshold on backend at submit/issue, including after any edit or new costing version.
- A previous sales-head approval does **not** automatically authorize a later costing version.

## 5. Other boundary tests

- Reproduce all 9 prices exactly, to two decimal places, before any implementation refactoring.
- Accept margin 0%; reject margin <0% or >=100%.
- Half-up ties: ₹1.005 becomes ₹1.01; ₹1.004 becomes ₹1.00.
- No effective rate on `pricing_date` → visible error; overlapping rates → reject.
- Rate intervals `[effective_from, effective_to)`: on `effective_to` the old rate is no longer effective.
- After issuing a quotation, changing material/machine/GST rates must not change that issued snapshot or its PDF.
- Separate quote versions preserve original inputs, rates, rounding, status and approval provenance.

## 6. Verification policy

These expectations were computed outside the application using Python Decimal HALF_UP and independently cross-checked with exact rational (Fraction) arithmetic. **Before approval, the candidate should personally hand-check the spindle 100% case** and spot-check the other parts. Neither helper is the application costing engine.

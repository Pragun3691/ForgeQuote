# ForgeQuote — Costing contract v0.2 (T00 REVIEW — NOT YET APPROVED)

**Source of truth:** IsoCode Labs client brief. The client requires material, gross weight, machining route/cycle time, machine-hour rate, scrap, overhead, freight, margin, costing at 2–3 volumes, effective-dated rate masters, historical quotes, GST separately, and sales-head approval when a **quotation's annual value exceeds ₹25 lakh**. AI must never perform pricing calculations.

Everything below that fixes a missing business rule is **our engineering assumption for the take-home demo**, not a verified manufacturer policy. Confirm the contract with the candidate before marking ADR-0002 `ACCEPTED`.

## 1. Units and rounding

- Monetary inputs are decimal strings and database `NUMERIC`; calculate with an explicit decimal library, not JavaScript binary floating-point.
- INR amount line items round once to ₹0.01 using **ROUND_HALF_UP**. Sum rounded lines for `cost_per_unit`. Compute `selling_price_per_unit_ex_gst` from that rounded total and round once to ₹0.01. Display the same values in UI, PDF, database and tests.
- Reject negative weights, times, prices, percentages or invalid units. Margin must satisfy `0 <= margin_percent < 100`.
- Round percentage-derived **quantities** (50%/150% tiers of an odd requested count) to a whole unit using HALF_UP. Minimum annual tier quantity: 1. Do not invent a rate when one is missing.

## 2. Cost components for each part and volume tier

The fixture uses one machining operation per part; production code may sum multiple routing operations.

- `material = round_paise(gross_weight_kg * effective_material_rate_inr_per_kg)`
- `machining = round_paise(sum(cycle_time_min_i / 60 * effective_machine_hour_rate_i))`
- `scrap = round_paise(material * effective_scrap_pct / 100)` (allowance on material, **not** physical net yield)
- `overhead = round_paise(machining * effective_overhead_pct / 100)`
- `packaging = round_paise(effective_packaging_inr_per_piece)`
- `freight = round_paise(effective_freight_inr_per_piece)`
- A **routing revision** records setup time in hours *per batch* per operation. For each operation, `setup_cost_per_batch = setup_hours * effective_machine_hour_rate`. Sum over operations. Compute `setup = round_paise(setup_cost_per_batch * batch_count / tier_annual_qty)`.
- `cost_per_unit = material + machining + scrap + overhead + packaging + freight + setup` (sum the **rounded** lines).
- `price_per_unit_ex_gst = round_paise(cost_per_unit / (1 - margin_percent / 100))` (gross margin on selling price, not markup).

**Volume assumption:** Three editable annual-quantity tiers default to 50%, 100%, 150% of the RFQ's requested annual quantity. The 100% tier is the headline unit price. By default, `batch_count = min(12, tier_annual_qty)` planned production lots/year. Their integer quantities are split as evenly as possible; the first `tier_annual_qty % batch_count` batches have one extra unit. Setup per unit is based on total annual setup expense divided by tier annual units, not an individual lot's rounded size. For all nine golden fixtures `batch_count=12`, so `setup = round_paise(setup_cost_per_batch * 12 / tier_annual_qty)`. No quantity discounts for materials, scrap, overhead, packaging or freight; only allocated setup varies by tier. These are **scope-limiting assumptions**, not real manufacturing universal rules.

## 3. Tax

The quotation displays one configurable, **explicitly illustrative** GST percentage. For any displayed tier, `taxable_subtotal = sum(part_price_per_unit_ex_gst * tier_qty)` with already rounded unit prices; `gst_amount = round_paise(taxable_subtotal * snapshotted_gst_rate / 100)`; `total_with_gst = taxable_subtotal + gst_amount`. GST rate and amounts live in the quotation snapshot. CGST/SGST/IGST splitting, classification and actual invoice tax compliance are **not implemented**. Do not imply a demo GST rate is verified or legally applicable.

## 4. Versioned rates and pricing date

- A **costing version** has one explicit `pricing_date` (date only, interpreted as Asia/Kolkata business date; default is local today when created).
- Select the rate version for each key where `effective_from <= pricing_date < effective_to`; allow null `effective_to` for open-ended validity. Disallow overlapping effective intervals per key using a database exclusion constraint if supported, otherwise validate under appropriate transactional locking.
- Rate keys cover materials, machines, scrap, overhead, packaging and freight. Setup hours live in an identified routing revision, and machine rates used for setup are the selected machine rate versions. Snapshot GST percentage even if a separately configured global value changes later.
- Missing, ambiguous or overlapping rates **block calculation** with a visible error. No silent rate zero.
- Each costing version stores full inputs, routing revision and setup hours, pricing date, effective rate version IDs *and resolved values*, formula version, rounded line amounts, tier outputs, GST rate and results.
- Finalized/issued versions are immutable. Recalculating or editing creates a **new costing version**. The old version remains reviewable and reproducible; don't mutate an approval record in place.

## 5. Approval is per entire quotation, not per part

- Define `annual_quotation_value_ex_gst = sum(price_per_unit_at_100pct_tier(part) * requested_annual_qty(part))` across **all parts** in one quotation.
- Backend recomputes/validates this value against the persisted, current costing version on **submission/issue**; never trust an approval-needed flag or a browser-computed total.
- Approval is required only when `annual_quotation_value_ex_gst > ₹25,00,000.00` (exactly equal does **not** require approval). Above-threshold quotations can only be issued with sales-head approval for that exact quotation version.
- Below/equal threshold: **assumption** estimator may issue without sales-head review, and the snapshot records `approval_basis = below_threshold`.
- Editing a quote after approval creates a new version with no inherited approval; the previous approval stays attached to the original version as historical evidence. A new value and decision must be checked before the new version can be issued.
- PDF must be generated from the **issued immutable snapshot**; preview PDFs clearly indicate `DRAFT` and must not be mistaken for an authorized quotation.

## 6. Golden tests and guardrails

Use `docs/golden-cases.md` for nine independently computed expected values. Test rounding ties, missing and overlapping rates, effective_to boundary, 100% margin rejection, negative quantity, amount exactly ₹25,00,000.00 and one paisa above, multi-part quote aggregation (4 × ₹15 lakh parts → ₹60 lakh total requires approval), stale/unauthorized approval, and immutability after rate changes.

## 7. Outstanding business questions (not asserted as client facts)

Actual GST classification and treatment; scrap definitions; machine vs routing setup sourcing; margin vs markup; quantity discounts; batch scheduling; whether all quotes must pass sales head even below the threshold; quote validity and revision permissions. Our demo decisions above are explicit assumptions until real client clarification.

# Costing engine v0.1 — REVIEW REQUIRED

## Contract vs assumptions

**Client explicitly requires:** material, gross weight, route / cycle time, machine rate, scrap, overhead, freight, margin, 2–3 volumes, effective-dated rates, quote history, INR, GST separate, sales-head approval when **annual value exceeds ₹25 lakh**, and deterministic pricing (never by AI).

**Our proposed assumptions (must be approved and labelled in TDD):** per-unit material = gross weight × INR/kg rate; conversion = sum of (minutes/60 × INR/hour) over route operations; scrap allowance = material × scrap%; overhead = machining × overhead%; packaging and freight are per-unit values; setup = setup cost per batch / batch size; quote price uses **gross margin on selling price**; approval annual value uses stated customer annual volume × price at the 100% volume tier before GST. Candidate GST percentage is configurable, never assumed from client data.

## Arithmetic and units

- Source rates are decimal strings with explicit units, never ordinary JS floats.
- All rates effective on a particular quote date are resolved by `[effective_from, effective_to)`; disallow overlaps, reject missing rate.
- Round each monetary per-unit line to ₹0.01 using `ROUND_HALF_UP`: material, conversion, scrap, overhead, packaging, freight, setup. Sum those rounded lines to total cost per unit.
- `margin_fraction = margin_percent / 100`, require `0 <= margin_fraction < 1`.
- `price_per_unit_ex_gst = round_paise(total_cost / (1 - margin_fraction))`.
- `annual_value_ex_gst = price_100pct_tier × stated_annual_quantity`. Approval only when `annual_value_ex_gst > 2500000.00`.
- GST is computed separately from the selected volume scenario subtotal; show rate and taxable base. The real production tax treatment requires client confirmation; use an explicitly documented demo assumption.
- Volume tiers default to 50%, 100%, 150% of **stated annual volume**, editable. Batch size is a separate, explicitly displayed quantity; for fixture data only, default each scenario batch size to `annual_tier_volume / 12` where divisible (assume 12 equal lots yearly). Don't confuse batch size with annual volume.
- An issued quote freezes original inputs, selected rate version IDs AND rates, formula version, rounded line amounts, selected volume tiers, computed price, approval decision. A new change creates a new version.

## Unknowns to document

Is margin gross margin or markup? What percentage bases for scrap and overhead? Should packaging, freight and setup be rate masters? What is the GST assumption? How are non-divisible batch sizes handled? Does a below-threshold quote skip approval? How are quote revisions authorized? The answers above are **proposals**, not client-provided facts.

## Negative and boundary tests

Reject negative weights, zero/negative batch size, invalid currency/rate units, missing effective rates, overlapping effective periods, margin >= 100%, stale client calculation, non-estimator edits, unauthorized approvals, duplicate approvals, mismatched quote version. Check exact ₹25,00,000 threshold and ₹25,00,000.01. Verify old PDF and stored quote after rates change.

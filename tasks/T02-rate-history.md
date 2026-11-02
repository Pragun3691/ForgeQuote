# T02 — Effective-dated masters and immutable quote versions

**Superseded numbering:** Owner assigned T02 to RFQ intake on 2026-11-03. Active task: [T02 RFQ intake](T02-ai-rfq-intake.md), branch `feature/T02-ai-rfq-intake`. Retain this old scope as background; history/snapshot foundations were implemented in T01. This file does not authorize rate editing or issuance.

## Acceptance
- Edit rate by adding a new effective-dated version, not overwriting previous version.
- Disallow overlapping effective date periods per rate key; `[from, to)` boundary tested.
- Issue two quotes on either side of a rate change; old result remains unchanged.
- Store quote snapshot with rate IDs, amounts, formula version and inputs; a recompute-from-snapshot test matches saved results.
- Missing period returns a clear error, never zero.
- Owner explains what happens when a quote is revised after approval.

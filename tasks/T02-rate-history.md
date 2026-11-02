# T02 — Effective-dated masters and immutable quote versions

**Branch:** `feature/T02-rate-history` (after T01 merge)

## Acceptance
- Edit rate by adding a new effective-dated version, not overwriting previous version.
- Disallow overlapping effective date periods per rate key; `[from, to)` boundary tested.
- Issue two quotes on either side of a rate change; old result remains unchanged.
- Store quote snapshot with rate IDs, amounts, formula version and inputs; a recompute-from-snapshot test matches saved results.
- Missing period returns a clear error, never zero.
- Owner explains what happens when a quote is revised after approval.

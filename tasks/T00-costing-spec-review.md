# T00 — Costing specification review (no coding yet)

**Goal:** Independently verify and approve the financial contract before asking an agent to implement it.

## Steps
1. Read `docs/costing-spec.md`. Verify formulas, units, rounding and volume-tier assumptions against the original client brief.
2. Manually calculate one of the 100%-tier sample cases using a calculator and compare to `docs/golden-cases.md` (not code-generated output from our app).
3. Approve or revise `docs/decisions/0001-stack.md` and `docs/decisions/0002-financial-policy.md` by changing `Status: PROPOSED` to `Status: ACCEPTED` only when understood.
4. Write the policy for GST demo value (do not claim it is the client's tax determination), missing rates, approval for below-threshold quotes and batch-size rounding.
5. Record unresolved assumptions honestly in `docs/learning-log.md`.

**Exit gate:** Owner can explain margin vs markup, one full calculation, historical rates and ₹25 lakh approval boundary. No application code should implement unresolved policy as if it were confirmed.

# AGENTS.md — ForgeQuote engineering contract

You are working on an individual internship take-home. Build production-minded, but avoid overengineering. The owner must be able to explain every formula, schema, API, failure mode, and important design decision.

## Before every implementation task

1. Read `docs/current-status.md`, `docs/requirements.md`, `docs/costing-spec.md`, `docs/decisions/`, and the active `tasks/Txx-*.md`.
2. Send a short **implementation plan**: files to change, data flow, assumptions, test cases, risks, and deployment impact.
3. **Wait for the owner's plan approval before editing application code.** You may inspect files and propose tests before approval.
4. Work on `feature/Txx-<slug>`, make small conventional commits, and never overwrite or rebase others' work without instruction.
5. Implement the smallest end-to-end vertical slice; no fake buttons, mock AI masquerading as real AI, hardcoded persisted results, or silent fallbacks.
6. Add tests first or alongside changes. Verify against externally specified golden values, **not against your own implementation's outputs**.
7. Complete a handoff: changed files, endpoints, migrations, tests run, known gaps, deployment status, 3 questions to test the owner's understanding. Update `docs/current-status.md`, `docs/learning-log.md`, and `docs/decisions/` when a decision changes.

## Non-negotiable financial rules

- PostgreSQL NUMERIC and decimal-string transport; use an explicit decimal library for Node arithmetic. No JS binary floats for money.
- INR; paise rounding with HALF_UP as a **proposed** policy (confirm in T00). Round individual monetary cost lines first, then sum; quote from the sum. `docs/costing-spec.md` is authoritative once approved.
- Never let AI calculate costs or approve a quotation.
- Missing historical rate = visible error; never default a rate to zero.
- Effective date periods are start-inclusive/end-exclusive. No overlapping active rate periods for the same key.
- An issued quote is immutable; revisions create new versions. Preserve effective rate IDs, resolved values, formula version, inputs, calculated outputs and decision timestamps.
- AuthZ checks MUST occur server-side for all state-changing endpoints. Elevated approvals require sales-head role.
- Store no actual NDA-covered drawings or real personal data in the demo.

## AI data rules

- Synthetic RFQs for demo. Only use a provider whose applicable terms are checked for use of the documents; record the provider and policy in an ADR.
- AI extraction proposes fields with source text; server validates schema and checks exact source quotes against extracted text where possible.
- Require estimator confirmation; show failures and manual-entry fallback. Never invent a confidence number.

## Scope guardrails

Core: RFQ register, intake AI, costing and multiple volumes, rate history, approval, PDF, login/roles, database, tests, polished essential states. Optional: historical import, similar-part recommendations, ERP integration (explicitly out of scope).

## Time guardrails

Aim complete by Nov 6; Nov 8 is contingency only. Keep Nov 9 for submission. Deploy a minimum frontend + API + DB early; prefer an honest partial feature over an impressive broken one. Cap initial visual research and component selection at ~90 minutes.

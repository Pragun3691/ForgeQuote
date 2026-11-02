# T01 — First real, deployed end-to-end vertical slice

**Branch:** `feature/T01-thin-slice`

## Goal

Seed one synthetic RFQ and material/machine rate; display a React RFQ form → POST to Express → perform deterministic Decimal costing → store draft quote and inputs in PostgreSQL → GET draft → render actual saved value in UI. **Deploy API, UI and real DB early.**

## Must have

- JS/TS app code only after owner approves a plan.
- Migration(s), `.env.example` only with variable names, `.gitignore` already present.
- Database holds rate version references rather than merely copied display strings.
- Backend is source of truth; frontend does not calculate authoritative selling prices.
- Unit tests for one golden 100% tier, line rounding, missing rate and invalid margin; one API integration test for persistence.
- Basic loading and failed-request states; local setup/run instructions.
- Deployment smoke test for frontend → API → DB (do not claim deployed unless accessible).
- Update status, learning log, and task handoff after tests.

## Explicitly NOT in this slice

AI intake, approval, multiple routing operations, quote PDF, full UI polish. Those follow in subsequent slices and are still required for full assignment.

## Acceptance demonstration

Create RFQ-2611-014 draft, calculate against effective date, see expected `₹149.70`/unit at 180,000/year using `docs/golden-cases.md` v0.2 **assumptions**, reload page and retrieve same saved draft. Missing rate shows error instead of zero. Verify DB contains the quote and selected rate IDs.

## Before editing

Coding agent must present: endpoint contracts; proposed SQL tables/relationships; money handling & rounding; proposed deployment host; tests; risks; exact file plan. **Wait for owner approval.**

## Owner authorization - 2026-11-02

Milestones 1-3 authorized: reconcile docs; workspace/configuration; migration and synthetic seed with database tests. Stop before authentication or costing. Milestone 4 adds real PostgreSQL-backed sessions, demo roles and backend authorization before public writes. Six rate categories use append-only effective starts (ADR-0003), not schedules. No paid hosting required. Preserve v0.2 formulas, nine goldens, illustrative GST 18%, and baseline quantity in new quote snapshots only. Later gates: auth tests, goldens, persistence, browser-to-database workflow, verified deployment.

Milestone 4 subsequently authorized and completed: real session authentication, demo-user seed, CSRF, role checks, login throttle and connected login screen. Stop again for review before milestone 5. Authentication does not authorize implementing costing or quotation persistence.

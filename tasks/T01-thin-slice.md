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

Milestone 5 separately authorized: pure deterministic decimal.js costing only; all nine golden cases, safety/boundary tests and existing regressions. No new quotation tables, persistence, HTTP wiring, UI changes, approvals, AI or PDF. Stop for review before milestone 6. ADR-0002 and golden expectations remain unchanged.

Milestone 6 separately authorized and completed: migration 003 normalized PostgreSQL quotation snapshots, immutable version history, transaction/header-based atomic versioning, trusted GST, server-side actor checks, saved-value retrieval and formula-version diagnostic reproduction. Existing costing implementation and all nine golden expectations unchanged. No prior migration/data reset or ownership changes. See ADR-0005 and docs/quotation-persistence.md for schema, service contracts, real test evidence, security limits and exact handoff. Local migration/repeat and permissions passed; 39 unit/config/API tests and 33 reported PostgreSQL tests passed. No deployed claim. STOP before Milestone 7; HTTP quotation endpoints, React costing, approvals, PDF and AI require another review.

Milestone 7 plan subsequently APPROVED with refinements: one shared transaction for key lookup/quotation/receipt; UNIQUE(actor_user_id, submission_key); canonical validated business fields; same-key same-payload replay, changed-payload 409; exact pending key/body retained across uncertain network failures and refresh. Implemented the four authenticated HTTP routes and React RFQ costing workflow, plus additive migration 004. No formulas, prior migrations, golden expectations, existing ownership or data resets. Verified 39 unit/config/API tests, 44 reported PostgreSQL tests, 33 costing tests, production build and both actual Chrome suites; full process restart and lost-response recovery passed. See docs/milestone-7-handoff.md and ADR-0006. Local only; STOP before Milestone 8 or deployment.

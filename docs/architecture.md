# Proposed architecture (not implemented yet)

```text
Estimator/Sales Head React UI
          |
  Express API (session authentication, authorization, validation)
     |         |           |               |
  RFQ CRUD  costing      approvals       intake AI
     |       engine          |          (document parser, evidence)
     +---------+-------------+---------------+
               |
           PostgreSQL
  users, rfqs, parts, rate_versions, quote_versions,
  quote_lines, approval_events, extraction_runs
               |
    server PDF renderer consumes frozen quote snapshot
```

**Transaction invariants:** approving a quote must compare the current quote version; publishing and approving must not overwrite the snapshot. Rate selection uses effective date and must fail if no rate. Split user-entered RFQ facts, AI suggestions, approved inputs and calculated results.

**First slice:** One part, seeded material and machine rates, a small RFQ form, POST calculate on backend, persist quote draft, retrieve and display. Defer AI, permissions polish and PDF to later slices. Have an online deployed URL and DB from the start, not an all-local app until Nov 6.

**Schema design follows the approved costing spec.** Entity names here are conceptual, not final migration contracts.

## Authorized T01 checkpoint

React/Vite JavaScript and Express share one production origin. pg for PostgreSQL; decimal.js for finance. Milestones 1-3 cover workspace, schema and synthetic data only. No public writes. Milestone 4 adds persistent sessions and roles. AI, approvals and PDF deferred.

Rates use unique effective starts and derived ends (ADR-0003); routing revisions append-only. Future snapshots retain inputs, rate IDs/values, routing, date, formula, results and illustrative 18% GST. Baseline edits change quote inputs, not RFQ facts.

Future quote transactions: READ COMMITTED; lock RFQ; resolve dependencies in one statement; allocate next version while locked; insert atomically. Two retries maximum after confirmed serialization/deadlock rollback. Never replay uncertain commits. Service not implemented in milestones 1-3.

## Milestone 4 authentication

Implemented: React login/logout -> same-origin Express -> session/user lookup in PostgreSQL. Session bootstrapping supplies CSRF; successful password verification regenerates the session ID/token. Backend roles are authoritative; user activation is checked on every authenticated request. See ADR-0004 for hashing, expiry, cookies, throttling and proxy details.

Quotation-version/part/snapshot tables do not exist and remain a milestone 6 dependency. No draft URL is implemented; role/CSRF middleware is exercised on a test-only probe. No real quote-write authorization is claimed. Migrations/seeds require a separate maintenance connection; runtime grants are table-specific. Historical ownership is unchanged, including the existing local auth-table ownership limitation documented in ADR-0004.

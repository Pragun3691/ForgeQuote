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

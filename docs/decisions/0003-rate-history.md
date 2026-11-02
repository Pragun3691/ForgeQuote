# ADR-0003 - Append-only effective-start rates

- **Status:** ACCEPTED - explicit owner direction, 2026-11-02.
- **Decision:** UUID, key, decimal value and effective-from date per version. Unique (key, start). Resolve latest start on/before pricing date; derive exclusive end with SQL lead. Last period open-ended.
- **History:** Triggers reject UPDATE, DELETE and TRUNCATE on rates and routing revisions. New values require INSERT. Runtime accounts must not own tables or have maintenance privileges. Owners/superusers remain trusted DDL operators.
- **Limits:** No schedules, expiry column, exclusion extension or explicit expiry gaps. Derived intervals cannot overlap. Before first start, fail visibly. Backdated inserts can change a new calculation on an old date; saved snapshots retain original IDs and values.
- **Relationship:** Owner-authorized storage refinement supersedes explicit-end/exclusion wording in costing-spec section 4 for T01. ADR-0002 and financial formulas unchanged.
- **Tests:** Start/next-start boundaries, before-first missing rate, duplicate start, append-only enforcement, decimal-string transport.

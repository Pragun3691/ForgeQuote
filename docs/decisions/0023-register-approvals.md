# ADR-0023 - operational RFQ register and approval queue

Owner approved M3 as the first part of a sequential M3/M4 assignment. M1/M2 behavior and charcoal/forest/ivory/crimson tokens remain authoritative.

Register controls filter a copied view of the existing GET /rfqs response. Search covers reference/customer; filters use returned RFQ status and assigned estimator; stable sorting uses date/reference/customer plus deterministic ties. Financial strings are never compared or coerced. Counts describe loaded results, with distinct no-record/no-match feedback and retained data on failed refresh. Filters are presentation, never authorization or server pagination.

Existing Open RFQ and version-bound Review quotation links occupy the leading table column and remain native keyboard links. Semantic tables and ScrollTable retain access to the remaining information. New RFQ remains role-specific; a known successful receipt supplies Open saved RFQ without another write.

URL parameters own list view state: q/status/estimator/sort for RFQs; aq/asort for approvals. Search replaces the current entry, while explicit select/reset navigation adds history. Existing hash parsing/role normalization remains unchanged. One auth-scoped destination reference in App supplies shell RFQs/Approvals destinations and detail return context; it contains URLs only and resets with identity. Workspace types, keys, retained intake/rates trees and form state owners remain unchanged. Query-only changes do not trigger task-heading focus or refetch the list. The legacy approvals anchor remains valid, with its scroll effect limited to task changes.

The pending queue preserves server-supplied saved-version order (oldest saved first) by default, with optional reference/version ordering and reference/customer search. It uses only available pending-snapshot fields and labels the saved amount as annual ex-GST. RFQ statuses stay separate from quotation lifecycle statuses. Queue reads retain abort guards, independent recovery and successful refresh invalidation. Mutation handlers are unchanged.

No endpoint, backend, database, financial formula, dependency, authorization or session change. All database-backed checks use the existing guarded disposable fixtures. Milestone verification and rollback are recorded in docs/m3-m4-handoff.md.

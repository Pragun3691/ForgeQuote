# T04 - Sales Head approval and controlled issuance

Owner explicitly authorized implementation, local disposable-database testing, documentation and one T04 commit on 2026-11-04; no additional approval round. Clean main and fetched origin/main both contained accepted deployment commit edc7295. Branch: feature/T04-approval-issuance.

## Implementation plan and contract

Add migration 006 quotation_events; extend exact runtime grants/checkers/readiness; add a dedicated lifecycle service and protected routes; add compact lifecycle/pending-review React components; extend PostgreSQL and Chrome tests; document ADR-0014 and handoff. No costing, GST, master resolution, snapshot persistence or migrations 001-005 changes.

Data flow: authenticated session actor -> current role/Origin/CSRF/UUID key validation -> actor/key advisory lock -> existing quotation header row lock -> current immutable version/baseline check -> append lifecycle event(s) -> commit -> receipt -> refresh lifecycle. The header lock is shared with version creation. Exact stored baseline > 2500000.00 requires Sales Head. Below/equal submit atomically appends submitted and auto_approved. Only approved/auto-approved current versions may issue.

Assumptions: rejection is terminal for that version; estimator creates a new version to resubmit. All existing demo-role read scope remains. Quotation number FQ-<full version UUID> is unique and stable, allocated only in the issued event; no sequential numbering requirement was supplied. Same-key retry returns the original receipt even after later events/new versions; it performs no new action.

Risks: untrusted SQL credentials remain outside HTTP actor-authentication guarantees; database owners can disable guards. Browser recovery depends on sessionStorage in the same tab. No push notifications: refresh lifecycle/pending list to observe other sessions. Cloud migration/grants must precede release; readiness requires 006. Cloud changes remain separately controlled.

## Verification and handoff

Threshold below/equal/one-paisa-over, current roles, reject reason, premature issue, duplicate/concurrent actions, stable numbering, stale versions/races, no inherited approvals, append-only/column constraints, transaction rollback, real below-threshold costing fixture, HTTP security and both-role Chrome workflow. Preserve all nine financial goldens. Full commands/results and owner questions: docs/t04-handoff.md. STOP after T04 commit; no Neon/Render access, push/merge, PDFs or rate management.

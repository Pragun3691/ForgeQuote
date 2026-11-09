# Terminal RFQ closure — approved implementation

Branch: `fix/terminal-rfq-closure`, from verified `origin/main` at `bceb4f95f5b538de32e1bc3c91eb137235e9dffb`.

Implement future quotation-write closure after Won/Lost, shared API/SQL locking, forward-only 008, readiness/inventory, read-only UI, newer-unfinished-version warning and permanent regressions. Preserve committed-request recovery, historical reads/PDF eligibility, roles, CSRF, financial strings/formulas, immutable snapshots and the historical Won-before-Version-3 records. No new dependencies or reopening feature.

Verify red/green closure and stale-isolation cases, draft/pending/approved closure, both concurrency orders, restricted SQL, receipts/conflicts, stale browser actions, retained inputs, queue and history/PDF bytes, plus the complete existing regression suite. See ADR 0028 and `docs/terminal-rfq-closure-handoff.md` for exact results and limitations.

Use disposable test databases only. No development/production migration/reset/seed; no Neon/Render changes; no staging, commit, push, merge or deployment. Stop for owner review.

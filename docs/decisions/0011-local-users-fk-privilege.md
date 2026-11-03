# ADR-0011 - Preserved local users ownership and foreign-key row locking

- Status: ACCEPTED under owner's focused development RFQ permission correction authorization, 2026-11-03.
- Supersedes ADR-0004's ordinary SELECT-only users ACL only when runtime already owns users. No ownership change; maintenance-owned/cloud users remains runtime SELECT-only.

## Cause and decision

RFQ creation checks the active estimator, obtains an actor/key advisory lock, checks the receipt, validates keys, inserts RFQ/parts/routes and finally inserts rfq_submissions in one transaction. The ordinary user lookup has no FOR UPDATE/SHARE clause. The failing statement is:

```sql
INSERT INTO rfq_submissions(actor_user_id,submission_key,request_fingerprint,rfq_id)
VALUES ($1,$2,$3,$4);
```

PostgreSQL's foreign-key check selects the referenced users row FOR KEY SHARE as its table owner. Development users is owned by forgequote_app, whose ordinary UPDATE ACL was revoked by the grant tooling. The internal lock consequently fails with 42501; the transaction rolls back and the API returns redacted 503. Maintenance-owned users in normal fixtures executes the check with maintenance privileges, explaining the passing tests. Runtime/maintenance actual identities and effective privileges were checked independently.

The necessary internal lock preserves referential integrity; removing an application lock cannot fix it. Do not remove the FK, bypass validation, change ownership, use maintenance in the application or grant table-wide UPDATE. The existing maintenance-only grant tooling now resets and conditionally grants UPDATE(id) on users when its owner is the runtime role. PostgreSQL requires UPDATE on at least one column for a locking SELECT: [PostgreSQL 17 SELECT privileges](https://www.postgresql.org/docs/17/sql-select.html). Password hash, username, role, active and created_at remain unmodifiable by ordinary runtime SQL. users INSERT/DELETE/TRUNCATE and table-wide UPDATE remain forbidden.

## Limits and verification

UPDATE(id) is a real column privilege: direct runtime SQL could change an unreferenced user ID. There is no identity-edit HTTP endpoint. The runtime already retains owner DDL/self-grant powers on preserved local users/sessions; this exception neither removes those powers nor makes this layout suitable for deployment. Strict fresh/cloud ownership remains maintenance-only and receives no users UPDATE grant. Any ownership repair requires separate approval.

The complete RFQ HTTP regression runs with maintenance-owned and disposable runtime-owned users, checking create/detail/retry/conflict/concurrency/rollback/authorization and exact effective users UPDATE columns. Forbidden auth-field writes and deletion fail with 42501. Actual local create/reopen/idempotency/conflict and role-denial checks passed without altering existing data/ownership. No existing migration, financial policy, rate history or snapshot changed.

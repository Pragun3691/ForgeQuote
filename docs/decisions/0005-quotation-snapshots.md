# ADR-0005 - Transactional immutable draft snapshots

- Status: ACCEPTED implementation of the owner's Milestone 6 authorization, 2026-11-02. Supersedes earlier statements that quote persistence/authorization are unimplemented. No Milestone 7 authorization.
- Migration: add 003 only; leave applied 001/002 and existing data unchanged. Run through the separate maintenance connection, then explicitly apply runtime-grants.sql. New snapshot tables remain maintenance-owned; no existing ownership changes.

## Transaction and version allocation

One quotation header per RFQ, with a BIGINT next_version counter. Within one READ COMMITTED transaction the service rechecks the active database user's estimator role, inserts the header if absent, and increments its counter with UPDATE ... RETURNING. PostgreSQL holds that row lock through commit. The unique RFQ key handles simultaneous first inserts; later increments serialize on the existing header. Failed work rolls back the header insertion/counter along with every snapshot row. Versions have a unique (quotation_id, version_number).

After allocation, a single SELECT resolves RFQ, all parts, explicitly selected routing revisions and latest effective starts for all six rate categories using one MVCC statement snapshot. Numeric values embedded in JSON are cast to text. Missing rates/routes and incomplete/duplicate part requests fail visibly. Quantity overrides and editable tiers belong to the new version; they do not change RFQ facts. The existing v0.2 decimal.js engine calculates each part and aggregated scenario totals. SQL contains no manufacturing costing formulas.

The internal actorId argument must come from authenticated server state. The database is queried for current activation/role; request-supplied role claims are never used. Only estimators create drafts; either active demo role can retrieve them. GST is constructor configuration, supplied by trusted server setup (normally readConfig().gstPercent, illustrative 18%). Unknown request fields including gstPercent are rejected. No HTTP endpoint exists.

## Simple immutability enforcement

Versions, parts, selected rates, tiers and totals reject UPDATE, DELETE and TRUNCATE. Drafts are immutable too: edits create a new version. Every version gets a database-generated xid8 creation_xid. A BEFORE INSERT guard permits children only when pg_current_xact_id() equals their version's creation_xid. Once the creating transaction commits, later transactions cannot append parts/rates/tiers/totals. Column grants prevent runtime from supplying creation_xid or created_at. Header updates are restricted to next_version, and a guard permits only increments of one; deletion/truncation are blocked.

This protects a demonstrated failure mode that UPDATE/DELETE guards alone miss: late INSERT could silently extend a committed quote. It requires no sealing UPDATE, deferred triggers or privileged stored procedure. PostgreSQL must support xid8/pg_current_xact_id() (PostgreSQL 13+).

Trade-off: the service, not a deferred database completeness validator, guarantees all RFQ parts, six rates and three scenarios are saved. Direct SQL with stolen runtime credentials could create an incomplete or fabricated new version, skip counter allocations, or claim an existing user ID. Integrity guards validate part/RFQ/routing membership and rate ID/key/value/start/category correspondence, not the full JSON schema or engine formulas. Such credentials must never reach clients. Database owners/superusers can disable guards; this is operational trust, not cryptographic evidence. A privileged-procedure-only writer or stronger database completeness enforcement can be considered if an additional untrusted writer is introduced. No such writer is currently implemented.

## Financial capacity and history

Raw rates/GST retain NUMERIC(18,6), matching the engine's 12-integer/six-fraction input contract. Outputs use an unconstrained NUMERIC quote_amount domain: finite, nonnegative and already exact to paise. A domain check rejects fractional paise instead of silently rounding to NUMERIC(p,2). This accommodates valid extreme products, near-100% margins and annual totals without narrowing the approved contract. pg NUMERIC/BIGINT parsers remain decimal strings; inputs in JSON are strings. SQL only checks reference integrity, ranges, uniqueness, paise validity and total_with_gst = taxable_subtotal + gst_amount.

Snapshots preserve RFQ/customer labels, part facts, routing inputs/revision IDs, all selected rate IDs/resolved values/effective starts, pricing date, GST, formula version, creator/time, inputs, batch plans, monetary lines, unit prices, part annual values and quotation scenario totals. Foreign keys prevent deleting referenced master rows, while copied facts preserve history if mutable RFQ/part data changes. Appended/backdated rates and routing revisions affect future calculations only. getDraftVersion reads snapshot tables and active-user authorization; it never joins current costing masters or recalculates. Diagnostic reproduction explicitly dispatches the saved formula version; unknown versions fail. Retain the old calculator when introducing a new formula version. No approve/issue/PDF workflow or decision timestamp is invented; created_at records draft creation only.

## Failure handling and future duplicate submissions

There is no automatic retry, including after an uncertain COMMIT. A lost COMMIT acknowledgement can mean the quotation was saved even though the caller received an error. Creation returns only its version-ID receipt after COMMIT; it does not add a potentially failing post-commit retrieval. PostgreSQL errors propagate to the internal caller; future HTTP error mapping remains unimplemented.

Before adding HTTP writes, introduce a client submission/idempotency key scoped to the authenticated actor and operation (and RFQ), protected by a unique database constraint. Save the key, normalized request fingerprint and resulting version ID in the same transaction as the quote. Repeating the same key and same content must return the committed receipt; different content must conflict. After a timeout/disconnect the caller must query/reuse that key, never blindly submit a new key. An absent/uncommitted result must be reconciled through this transactional uniqueness mechanism. No idempotency ledger or retry interface is claimed in this milestone.

## Evidence and remaining security limits

Real PostgreSQL tests verify all nine unchanged goldens after persistence, complete round-trip, missing-rate/calculation/storage rollback, concurrent existing and first headers, master/config changes, extreme exact amounts, late-insert/mutation guards, and a deliberately lost COMMIT acknowledgement producing exactly one commit. Service tests use a separate NOLOGIN runtime role with the exact maintenance grants and no table ownership. Migration/repeat, existing auth and rate-history tests pass.

Development migration/grants/checker passed. Existing users/sessions remain forgequote_app-owned and the runtime role still owns the development database; owner DDL/self-grant powers continue to block public runtime isolation (ADR-0004). New snapshot tables are maintenance-owned. No deployment, tenant/row-level ownership policy, approvals or HTTP integration is included. Both active demo roles can read every draft; this is a two-role synthetic demo, not multi-tenant access control.

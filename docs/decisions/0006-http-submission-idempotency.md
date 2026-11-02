# ADR-0006 - HTTP draft submission idempotency and browser recovery

- Status: ACCEPTED implementation of the owner's approved Milestone 7 plan and three transaction/key refinements, 2026-11-02.
- Scope: authenticated RFQ reads, draft POST, saved-version GET and React integration only. No deployment or later features. Costing formulas, golden expectations and applied migrations 001-003 remain unchanged.
- Relationship: implements ADR-0005's future HTTP submission-key contract. Existing snapshot/reference/immutability policies remain in force. Earlier statements that no quotation HTTP interface or idempotency ledger exists describe the Milestone 6 checkpoint.

## Atomic submission receipt

Migration 004 adds draft_submissions with UNIQUE(actor_user_id, submission_key), a version_id primary/foreign key, RFQ reference, SHA-256 request fingerprint and database creation timestamp. It is specific to draft creation, not a generic task/job ledger. The table rejects UPDATE/DELETE/TRUNCATE. An insert guard requires the version's creation transaction ID, actor and RFQ to match the submission, preventing receipts attached later to unrelated history. Runtime gets SELECT and column-specific INSERT only. Maintenance owns the new table; no existing ownership changes.

createSubmissionService validates/canonicalizes the business request, then performs all database work in **one PostgreSQL transaction on one client**:

1. Recheck the actor's activation and estimator role.
2. Take a transaction-scoped advisory lock for the canonical actor/key using PostgreSQL hashtextextended. All draft requests use the same operation-specific lock prefix. A hash collision only causes extra waiting.
3. Look up (actor_user_id, submission_key). Same fingerprint returns the original version ID; a different fingerprint raises SUBMISSION_CONFLICT (HTTP 409). Replay does not re-resolve rates or depend on current RFQ parts/configuration.
4. For a new key, reject unsupported RFQ cardinality, invoke createDraftVersion with this shared client, and insert the receipt referencing the newly assembled snapshot.
5. Commit once; only then send the HTTP receipt. Any failure rolls back the counter, snapshots and receipt together. The UNIQUE constraint remains the final duplicate guard.

The quotation service's optional internal `{ client }` argument delegates transaction ownership to its caller; it never opens a nested/separate transaction when a client is supplied. Its standalone interface still opens its own transaction for existing service tests/callers. The shared-client interface must never receive browser-supplied state. No automatic retry was added. A lost COMMIT acknowledgement is a visible error; the caller explicitly retries the same key and body to recover the saved receipt.

Alternatives: a nullable pending-receipt row would require a finishing UPDATE and more lifecycle rules. A process-local lock would fail across API restarts/instances. A transaction-scoped advisory lock plus a final non-null receipt keeps the write path simple and requires only append permissions. The guarantee covers this HTTP submission path; direct maintenance/internal service calls without a key intentionally remain outside it.

## Canonical business request

The HTTP body has exactly pricingDate, partId, routingRevisionId, marginPercent and tierQuantities (exactly 50/100/150). All are explicit; the baseline quantity also becomes requestedAnnualQty for this new version. HTTP T01 supports exactly one RFQ part and one selected one-operation routing revision. Existing internal multi-part service support is retained; unsupported HTTP combinations fail visibly.

Canonicalization validates UUIDs and lowercases them; validates real YYYY-MM-DD dates; validates decimal-string margin 0 <= margin < 100, at most six fractional digits; and validates positive integer-string quantities <= 1000000000. Margin trailing fractional zeros are removed using string operations, so 20 and 20.000000 are equivalent. It builds a fixed-shape/fixed-order object containing RFQ ID, date and the single selected part/route/margin/quantities. JSON.stringify of this object is SHA-256 hashed. Object property order in the submitted JSON does not matter. No binary floating-point arithmetic is used for financial values.

The key, CSRF token, cookie, user-supplied role, HTTP headers, current rates and current server GST setting are excluded. The actor scopes the database key separately. Arbitrary GST/rates/results/role fields are rejected rather than accepted into the body. The original saved receipt must be returned even if trusted configuration or master data subsequently changes. Different keys intentionally create different versions even when business inputs match. Keys have no expiry in this milestone; deleting them would weaken long-delayed replay safety.

## HTTP and UI boundaries

All four business routes require the existing session middleware and active-user lookup. POST additionally requires estimator role, exact Origin and session CSRF token; sales head is read only. GST comes from readAuthConfig, illustrative 18%. Responses are Cache-Control: no-store. Error mapping distinguishes validation, authorization, missing references/rates, key conflict and service unavailability without exposing PostgreSQL/internal error details. Readiness now requires migration 004 in the ledger. The existing 4 KiB request limit is sufficient for one-part submissions and unchanged.

The UI renders only saved GET outputs for prices, seven cost lines, three scenarios, annual GST totals, formula/rate/version provenance. Formatting groups decimal strings without converting them to JS numbers. RFQ default quantities are supplied by the server, using integer quantity arithmetic; default margin 20% is an editable starting input, not a persisted price. Rates, cycle/setup time and weights are stored master inputs. Baseline edits affect the new quotation only.

Before the first POST the browser stores `{ submissionKey, body, phase }` in sessionStorage scoped by actor and RFQ. A storage failure blocks saving. Unknown network/service outcomes freeze the exact payload and offer an explicit same-key retry. Reload restores the pending key/body; an interrupted 'saving' phase is treated as uncertain. Successful receipts are retained for replay and the version ID is put in the URL hash so refresh/restart reads the saved version. Confirmed 400/404/422 failures permit correction under the same uncommitted key. CSRF/session failure preserves the key; refresh/re-login obtains a fresh security token separately.

Only the explicit Start new calculation action generates another key after a submission exists. It warns that an uncertain earlier outcome should be reconciled first; choosing a new calculation is an intentional new operation. Pending entries are not automatically discarded on logout or session expiry. sessionStorage survives refresh in that tab, not tab closure/storage deletion/another browser. The saved-version URL is independent of browser storage. No automatic background POST retries are performed.

## Verification and remaining limits

Real restricted-role PostgreSQL/HTTP tests cover identical and canonical replay, different-content conflict, six concurrent same-key requests (one 201, five 200, one version), intentional new keys, full rollback on receipt insertion failure, lost COMMIT acknowledgement, unchanged financial goldens and protected reads/writes. Chrome tests commit a real POST then abort its response, reload the tab, verify the identical key/body and recover via HTTP 200 without a duplicate. They also restart the actual API child process with the same database/secret/port, retain login/snapshot, and verify expired-session recovery and sales-head denial.

Existing ownership of development database/users/sessions by runtime remains a public-deployment isolation blocker. Direct compromised runtime SQL could fabricate new snapshots/receipts; service validation and trusted credentials remain a boundary. Both active demo roles can read all RFQs/drafts; there is no tenant/row-level ownership isolation. No quote-write throttle, pagination, retention policy or load test was added for this small synthetic dataset. Login throttling remains process-local. Browser pending payloads persist in that tab after logout; synthetic data only, no credentials/CSRF tokens are stored there. Malformed/unavailable storage blocks new saves. No approval, issuance, AI or PDF workflow; every displayed quotation is an immutable draft. No deployed HTTPS/backup/production recovery claim.

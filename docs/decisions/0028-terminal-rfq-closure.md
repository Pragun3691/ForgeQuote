# ADR 0028 — Terminal RFQ closure

Status: owner approved; implemented locally, not deployed.

## Rule and historical compatibility

Won/Lost prohibits future quotation creation, submission, approval, rejection and issuance. ADR 0017 originally made the outcome immutable and required prior issuance but did not freeze quotation writes. A November 5 Won event followed by a created/approved/issued Version 3 on November 9 was possible under 001–007. Preserve that history.

008 checks future writes against all closed RFQs. It changes no existing RFQ, outcome, version, snapshot, event date or PDF data. It introduces no winning-version association or reopening. Original IsoCode screenshots remain unavailable; this records the explicit owner rule, not an unverified original requirement.

## Locking and enforcement

Allocation, version insertion, lifecycle events and closure acquire the same quotation-header row lock to transaction end. Valid closure already has a header because issuance is required. Replace the former outcome-only entity advisory lock with the header lock. API actor/request locks and unique receipts remain and precede the header. No quotation path acquires the former outcome entity advisory lock.

After locking, closure-first rejects new quotation writes with `RFQ_TERMINAL` / HTTP 409; quotation-first commits before closure. SQL allocation, version-insert and event guards independently enforce closure (SQLSTATE 55000). The outcome trigger shares the lock and retains role/prior-issuance checks.

Regression tests reproduced a stronger-isolation bypass: repeatable-read/serializable snapshots may retain a pre-closure view after acquiring a header that was only locked. These four SQL write guards fail closed at those isolation levels with SQLSTATE 25000. READ COMMITTED is the supported write isolation; PostgreSQL READ UNCOMMITTED has equivalent semantics and is accepted. Application transactions use plain BEGIN and inherit server defaults; disposable verification targets use READ COMMITTED. A release must verify the runtime connection's default before enabling writes. Stronger-isolation historical reads remain available. No database configuration changes.

## Recovery and presentation

Authorization and validation remain. Successful actor/key receipt lookup and intent comparison precede terminal rejection. Identical committed saves and lifecycle actions—including rejection and issuance—return original receipts even if superseded/closed. Changed intent conflicts; new keys cannot create work. No automatic write retry. Uncommitted uncertain requests receive a definitive terminal conflict after closure.

Snapshots/history remain readable. PDF services and eligibility stay unchanged: customer PDF requires the current issued version; INTERNAL PDF permits historical saved versions under existing authentication. Closure does not enable superseded customer PDFs.

Additive live metadata: RFQ versions expose event-derived `lifecycleStatus`; lifecycle reads expose `rfqOutcome`. No snapshot changes. Closure preview lists newer unfinished versions after the last issuance and warns about other tabs. The server closes all unfinished versions even if the preview is stale.

Both roles receive a read-only explanation; retained inputs cannot create versions. Approval queues exclude closed RFQs. Stale-session conflicts refresh status without clearing action errors or moving focus. Exact-request recovery stays available. Confirmed closure clears inapplicable draft unload protection; unknown/failed reads retain F1 protection. RFQ sequencing retains F2.

## Deployment and rollback

008 is forward-only; 001–007 stay byte-identical. Readiness requires 008. Inventory becomes 18 tables, 8 functions and 35 triggers. Existing maintenance preparation grants/checks the new function using the established narrow policy; no new table/column grants.

A separate authorized release must quiesce writes, verify/back up the target, apply 008 and permission checks, start the reviewed release, and verify readiness/roles/terminal conflicts/history/PDFs. Avoid concurrent older instances during migration. Startup and this task do not migrate or seed development/production.

Before deployment, remove only this task's changes or restore its ignored checkpoint. After deployment retain 008 and its guards; an older API may show generic errors for closed writes, so prefer a compatible forward application correction. Changing the rule needs separate approval and a new forward migration. Do not disable triggers, delete outcomes or restore historical data to roll back presentation.

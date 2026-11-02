# ADR-0008 - Manual RFQ intake and retry receipts

- Status: ACCEPTED implementation of owner's T02 approval, 2026-11-03. Stop after T02.1; Gemini requires another approval.
- Branch: feature/T02-ai-rfq-intake from 099131f, identical to latest local main. Clean tree/ancestry verified first.

## Creation contract

Reuse rfqs, rfq_parts and routing_revisions. Request: reference, customerName, dueDate and 1-20 parts. Each part supplies partNumber, description, grossWeightKg, requestedAnnualQty, cycleTimeMin, setupHoursPerBatch and six explicitly selected rateKeys (material, machine, scrap, overhead, packaging, freight). Create revision 1 with one operation per part. No rate values, margin, GST, prices or results enter this endpoint.

Owner label comes from the active estimator's username; PostgreSQL defaults status to open. The receipt records creator user ID. Reject unknown fields and client ownership/status overrides. Trim outer text whitespace; references/part numbers remain case-sensitive. Reject duplicate part numbers and existing references. Past due dates are permitted: no scheduling rule was supplied.

Intake demo bounds: reference/part number 80 characters, customer 160, description 500; no control characters. Gross weight and cycle time strictly positive, setup hours nonnegative; decimals are strings with up to 12 integer/six fractional digits. Annual quantity is an integer string from 1 to 1,000,000,000. Positive weight/cycle requirements are intake assumptions, not changes to the engine's accepted zero inputs. Normalize decimals using string operations; intake performs no financial arithmetic.

Check every key exists in its correct category; database composite foreign keys also enforce categories. No implicit selection/free-text rate creation. Resolve actual rates only during quotation costing at its explicit pricing date. Registering a key does not guarantee an applicable historical rate; costing still fails visibly if missing, never substitutes zero.

## Atomicity and retries

Migration 005 adds only rfq_submissions: actor_user_id, submission_key, SHA-256 request_fingerprint, unique rfq_id and default created_at. Primary key: (actor_user_id, submission_key). Existing reject_history_mutation protects receipts against UPDATE/DELETE/TRUNCATE. Migrations 001-004 stay unchanged.

One transaction rechecks the active estimator, locks actor/key with a transaction advisory lock, checks the receipt, validates keys, inserts header/parts/routes and inserts the receipt. Failure rolls everything back. Identical canonical replay returns the original RFQ before reading current keys. Changed content on the same key returns 409; a new key with an existing reference also returns 409. No automatic POST/COMMIT retry or receipt expiry. An uncertain COMMIT is reconciled explicitly with the original key/body.

Canonicalization fixes property order, trims text, lowercases UUIDs and strips fractional trailing zeros. Part array order is part of intent. Exclude security tokens, cookies, owner label, timestamps and current rates from the hash.

## HTTP, browser and grants

GET /api/rfq-rate-keys requires an active user and returns IDs/codes/categories/units. POST /api/rfqs requires estimator role, exact Origin, session CSRF token and UUID Idempotency-Key. Return {rfqId,replayed}, 201 new/200 replay and Location pointing to existing detail. Invalid input 400, key/reference conflict 409, oversized input 413, redacted database failure 503. Only RFQ POST accepts 64 KiB; other requests retain 4 KiB. Separate process-local limiter: 30 estimator attempts/15 minutes, replays included.

Manual review confirmation resets when inputs change. Before POST, persist exact key/body in actor-scoped sessionStorage. Unknown outcomes freeze edits and allow explicit same-key retry across refresh/sign-in. Confirmed input/reference rejection permits correction using the uncommitted key. Storage corruption/failure blocks saves. Saved receipt remains available until Create another RFQ begins new intent. Unsubmitted edits are not autosaved; tab closure/storage deletion loses recovery. Synthetic, nonconfidential data only.

Runtime gains column-specific INSERT into RFQs/parts/routes/receipts and receipt SELECT. No input/master UPDATE/DELETE, rate writes, status/timestamp overrides or DDL. Both permission checkers and strict trigger inventory include 005: 16 tables, 27 triggers and four existing functions. Maintenance applies 005 before runtime grants; readiness requires 005. Existing local ownership limits remain. Only disposable test fixtures were migrated/regranted in this task.

Service completeness and receipt correspondence are trusted invariants, not database assembly guards. Stolen runtime SQL credentials could fabricate/incompletely insert intake rows or associate receipts with existing RFQs. Credentials remain server-only; owners can disable guards. No tenant isolation, RFQ update endpoint or general audit log.

## Boundaries

Multiple-part intake/read works; existing HTTP costing UI/API still visibly supports one part. Internal multi-part costing and nine goldens remain unchanged. No AI/SDK/provider/key request, upload, Excel, PDF, approval or rate editor. T02.2 can propose evidence-backed fields for this same validated save contract, retaining human review and manual fallback. The owner's initial configurable model direction is gemini-3.5-flash-lite; provider terms, synthetic-only enforcement and real official SDK verification belong to the next approved task before claiming AI completion.

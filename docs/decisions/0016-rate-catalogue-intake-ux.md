# ADR-0016 - Read-only rate management and estimator-controlled intake suggestions

Status: ACCEPTED under the owner's conditional T06 implementation authorization, 2026-11-05. Extends the read surface only; ADR-0003 rate history, ADR-0008 intake and financial policy v0.2 remain unchanged.

## Existing authority determines the supported feature

The accepted runtime ACL is SELECT-only on rate_keys, rate_versions and rate_periods, with no ownership or DDL authority. Current roles authorize estimator intake/costing/issuance and Sales Head decisions, not master-rate creation. The owner explicitly instructs safe supported functionality and documentation when editing requires a new policy. Therefore neither role gains a rate-write endpoint or INSERT/UPDATE/DELETE privilege. Authenticated POST/PUT/PATCH/DELETE on /api/rates and subpaths return 403 RATE_WRITE_FORBIDDEN after the existing exact Origin/CSRF checks; anonymous requests return 401. The UI explains the read-only scope and has no fake Add/Save button. No privileged connection/function or maintenance credential enters the app.

Adding rate versions remains a separately approved decision: designate a writer, allowed backdating/future starts, audit/source fields, validated decimal-string precision (before PostgreSQL NUMERIC coercion), request idempotency and exact narrow grants. Direct trusted maintenance SQL can coerce excessive fractional precision to NUMERIC(18,6); T06 does not claim to add a validator to that existing operator path. All browser/API rate writes, including over-precision values, are denied. Do not treat SQL's implicit rounding as an approved authoring workflow.

## Catalogue contract

GET /api/rates?asOf=YYYY-MM-DD requires an active estimator or Sales Head. Optional asOf defaults to today's Asia/Kolkata date; real date validation and unknown-query rejection occur server-side. The service rechecks current activation/role, then one SELECT statement returns all six key categories and consistent rate history. JSON values are explicitly cast to text before aggregation, retaining all six decimal places.

Response: {asOf,canWrite:false,rateKeys:[{id,code,category,unit,versions:[{id,value,effectiveFrom,effectiveTo,createdAt}],currentVersion: version|null}]}. Periods come from the unchanged rate_periods view: each start inclusive, next start exclusive, last open-ended. Unique (key,start) forbids duplicate starts; derived ends cannot overlap and explicit expiry gaps are unsupported by ADR-0003. No rate before first start is represented by null, not a zero value. Effective rates are still resolved by the unchanged costing code at its saved quotation pricing date.

The UI offers all/category filtering, an as-of date, current value, expandable history, effective dates, units, version/key UUIDs and database creation timestamps. Source supplier/author is not recorded in the schema, so the UI states this rather than inventing provenance. Existing authenticated intake-key endpoint remains unchanged for compatibility. The intake form uses catalogue metadata to distinguish a usable candidate from a bare key with no applicable history. No catalogue row is modified.

## Intake UX and financial authority

Gemini and Excel retain their exact existing verification/parser/provider/consent paths. Each review now begins with a compact component summary. RFQ/part source evidence remains accessible via native keyboard-operable details/summary controls; Gemini status/quote/offsets and Excel raw/normalized cell/header references are unchanged and are not persisted. Imported fields still replace the form only through the existing explicit apply action; keys stay empty after import/extraction.

The manual form provides component counts, identifiers, quantities, missing-field/key lists and keyboard jump buttons that focus the selected part then enter its fields with Tab. All existing required fields remain required. A rate catalogue link during editing opens a new tab so unsaved edits remain in the original form.

For each unselected category, if exactly one real database key has an applicable version on the catalogue date, visibly list it as a suggestion. No automatic selection occurs. Use suggested keys for part N explicitly fills only empty categories with those unique candidates, preserving other selections. If zero or multiple usable keys exist, no unique suggestion is made. This is availability/category logic, not a Gemini material inference or supplier alias search. Optional exact-alias material suggestions are omitted because no approved alias registry exists.

Apply common rate keys to all parts explicitly copies all six valid selected IDs from part 1, replacing other parts' selections with a visible explanation. Both actions and all field changes clear final human-review confirmation. Both are disabled during saving, extraction/import, uncertain-save freeze or storage failure. They do not reshape persisted pending requests or generate submission keys. Existing server-side category/ID validation and idempotency remain authoritative; a human UI checkbox is not a new database permission.

Unavailable categories or a selected key with no applicable rate produce visible errors/warnings and links to history. RFQ registration still permits keys whose usable rate may lie at a different future pricing date, as before; costing visibly fails if no rate exists for its selected date. Never substitute zero or claim a current-date suggestion guarantees a historical quotation rate.

## Verification and boundaries

Focused real restricted-PostgreSQL and Chrome tests plus all existing regressions verify source evidence, explicit defaults/copy/reset, actual multipart save, date boundaries/history, role/SQL denials and immutable financial snapshots after a backdated append in a disposable fixture. Native details/buttons and responsive wrapping preserve keyboard/mobile use. No new migration, grants, financial formulas, write-service behavior, dependency or AI provider. No cloud action, push/merge or C1 audit. Known limits: full catalogue read without pagination in this small synthetic demo, finite schema provenance and the unresolved master-writer contract.

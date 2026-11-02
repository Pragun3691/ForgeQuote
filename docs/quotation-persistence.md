# Milestone 6 handoff - 2026-11-02

Implementation commits: `9654823` (transactional persistence) and `197cd39` (reject explicit null overrides) on `feature/T01-thin-slice`, starting from `1644ba1`. Documentation is committed separately. Milestone 6 only is complete; STOP before Milestone 7. No HTTP/frontend integration, approvals, AI or PDF was added. Public deployment has not started.

## Service contract

```js
import { createQuotationService, reproduceDraftVersion } from './apps/api/src/quotations.js';
// Internal server setup only; never derive this configuration from a browser body.
const quotations = createQuotationService(pool, { gstPercent: config.gstPercent });
const receipt = await quotations.createDraftVersion(authenticatedUser.id, {
  rfqId,
  pricingDate: '2026-11-02', // optional: defaults to Asia/Kolkata business today
  parts: [{
    partId,
    routingRevisionId, // explicit revision belonging to this RFQ part
    marginPercent: '20',
    // optional requestedAnnualQty: '180000',
    // optional tierQuantities: { '50': '90000', '100': '180000', '150': '270000' }
  }]
});
const saved = await quotations.getDraftVersion(authenticatedUser.id, receipt.versionId);
const reproduced = reproduceDraftVersion(saved); // explicit diagnostic, no DB access
```

Every RFQ part must appear exactly once. Rates, weights, cycle/setup inputs and master labels come from the database. Quantity overrides apply only to the new version. Scalars used in finance are decimal strings; quantities/version numbers from BIGINT remain strings. Request fields are strict, including rejecting browser GST, rates, output amounts and role claims. Trusted constructor configuration accepts the existing engine GST range; readConfig continues to enforce the approved illustrative 18% application setting.

createDraftVersion checks the actor in PostgreSQL, allocates the next number under a header row lock, resolves all dependencies from one database statement snapshot, calls the unchanged engine, and inserts the entire snapshot in one transaction. Returns `{ versionId }` after commit. getDraftVersion authorizes an active user and reconstructs saved part/rate/tier/totals data without live-master joins or calculation. A changed service GST setting cannot affect retrieval. Reproduction uses saved inputs/formula and rejects unknown formula versions; it does not replace the persisted result.

Expected internal errors include AUTH_REQUIRED, ROLE_FORBIDDEN, INVALID_QUOTATION_INPUT, RFQ_NOT_FOUND, ROUTING_NOT_FOUND, RATE_NOT_FOUND, QUOTATION_NOT_FOUND, UNSUPPORTED_FORMULA_VERSION and existing INVALID_COSTING_INPUT with field detail. PostgreSQL/storage failures propagate. There is no HTTP status/error mapping for this service yet.

## Tables and relationships

| Table | Relationship / purpose |
| --- | --- |
| quotations | One per rfqs.id (unique rfq_id); mutable next_version counter only |
| quotation_versions | Many per header; unique header/version number; creator -> users; RFQ snapshot, pricing date, formula, GST, timestamp, annual value |
| quotation_parts | Many per version; unique source part per version; references rfq_parts and routing_revisions; copied facts/routing, full engine inputs and annual value |
| quotation_rates | Six per saved part; composite part/version FK; rate_versions and rate_keys references plus resolved decimal value and effective start |
| quotation_part_tiers | Three per saved part; composite part/version FK; quantities, batch plan, seven lines, cost, price and per-part tax totals |
| quotation_totals | Three per version; quotation-level aggregated taxable/GST/inclusive amounts, rounded at quotation level |

Migration 003 adds these tables, the quote_amount NUMERIC domain and simple guards. No prior migration changed and no existing data was reset. See ADR-0005 for exact assembly/immutability trade-offs and future HTTP idempotency design.

## Executed verification

| Command / operation | Final actual result |
| --- | --- |
| npm.cmd test | 39/39 passed, including 33 costing tests and all nine independent golden cases |
| npm.cmd run test:db | 33/33 reported passed: 30 subtests and 3 parent tests; auth, migration/rate history and quotation persistence |
| node --test apps/api/test/quotations.test.js | 11/11 passed during development, before adding the additional concurrent-first-draft subtest; the final full DB run includes that extra passing subtest |
| npm.cmd run db:migrate | Development applied only 003_quotation_snapshots.sql |
| npm.cmd run db:migrate (repeat) | applied: [] |
| Explicit runtime-grants.sql via maintenance connection | Applied successfully; also applied twice in isolated test schema |
| npm.cmd run db:check-permissions | Passed; new snapshot tables maintenance-owned; existing auth ownership limitation reported |
| git diff --check | Passed before final commit |

The first attempted npm invocation was blocked by Windows npm.ps1 execution policy; npm.cmd worked. The first DB run exposed a test expectation: new snapshot foreign keys make plain TRUNCATE fail before the old trigger executes. Tests now use TRUNCATE ... CASCADE to prove the guards themselves reject it; no destructive operation succeeds. Subsequent full runs pass. No frontend/browser/build rerun was needed for this service-only milestone; no deployed smoke test is claimed.

Tests migrate into generated schemas in the dedicated TEST_DATABASE_URL database and clean up those schemas and a generated NOLOGIN role. Quote tests use MIGRATION_DATABASE_URL credentials retargeted to that same configured test host/port/database for maintenance, then assume the isolated runtime role. These tests require maintenance CREATE ROLE/SCHEMA capability; no maintenance URL/credentials are printed or committed. Existing auth/rate tests retain their dedicated test-schema workflow.

Concurrency evidence: two requests against the existing demo header produced versions `2` and `3`, same header, next counter `4`; counts were 3 versions, 3 parts, 18 rates, 9 part tiers and 9 quote totals. Against a new RFQ they produced versions `1` and `2`, one header, counter `3`. A failed first calculation left no header. No lost writes or allocation gaps from failed work.

Historical evidence: initial spindle quote priced 2026-11-10 saved material rate 100 and baseline 149.70/unit, annual ex-GST 26946000.00, GST 4850280.00, total 31796280.00. Inserting a backdated 2026-11-03 material rate 200, appending a routing revision, changing RFQ/customer/part/quantity data and changing service GST to 5.5 left retrieval deeply equal to the original snapshot. Diagnostic reproduction matched saved results. A new version used the new facts/rate/config. The three-part quote round-tripped all nine golden tiers and baseline totals 82650240.00 ex-GST, 14877043.20 GST and 97527283.20 inclusive.

Capacity evidence: gross weight and material rate each 999999999999, margin 99.999999%, annual quantity 1000000000 with explicit tiers persisted unit price `99999999999800000000000100000000.00` and annual value `99999999999800000000000100000000000000000.00` exactly. Missing rates, invalid margins and an injected failure during totals insertion rolled back all allocations/rows. A simulated committed transaction with a lost acknowledgement raised once, did not retry and left exactly one new version.

## Changed files

- apps/api/db/migrations/003_quotation_snapshots.sql
- apps/api/db/runtime-grants.sql
- apps/api/package.json
- apps/api/scripts/check-permissions.js
- apps/api/src/quotations.js
- apps/api/test/database.test.js
- apps/api/test/quotations.test.js
- README.md
- docs/architecture.md
- docs/costing-engine.md
- docs/current-status.md
- docs/decisions/0005-quotation-snapshots.md
- docs/deployment.md
- docs/learning-log.md
- docs/quotation-persistence.md
- tasks/T01-thin-slice.md

## Limitations, risks and deployment

Local development only: migration/grants applied; no hosting or public service. Quote creation/retrieval has no HTTP/UI interface. No approval/issue state or PDF; all versions remain immutable drafts. One operation per part. No tenant/owner-specific read restrictions; both active demo roles read all drafts. The caller must supply actorId from trusted authentication. No duplicate-submission ledger exists yet; future HTTP writes require the ADR-0005 idempotency contract before retrying uncertain outcomes.

Completeness and formulas are enforced in the service, not reimplemented in SQL. Direct compromised runtime SQL could insert incomplete/fabricated new history or forge attribution, but ordinary privileges cannot change committed snapshots or append children later. Owners/superusers can bypass triggers. Existing runtime users/sessions/database ownership remains a public-deployment isolation blocker; no ownership change was made. The new tables are maintenance-owned and have restricted privileges. Inputs/outputs are retained in full; use synthetic RFQs only. Future formula changes must keep the old reproduction implementation. No load testing or production recovery/backup validation is claimed.

## Owner understanding questions

1. Why does incrementing the single header counter in the same transaction prevent duplicate version numbers, including simultaneous first drafts and rollback?
2. Why save both rate IDs and resolved values plus RFQ/routing inputs, and why must historical retrieval avoid recalculation?
3. How can COMMIT succeed while the caller sees an error, and how would a transactional submission key prevent duplicate HTTP submissions?

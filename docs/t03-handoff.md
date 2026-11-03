# T03 - Complete multipart quotation integration

Branch: feature/T03-multipart-quotations; starting committed HEAD d29d2b5. Owner approved implementation/testing/commit. Recovery inspected status/branch/log/full diff and retained all three interrupted backend edits: quotation-request normalization, removal of the one-part HTTP gate and bounded quotation POST parsing. No unrelated edits or existing T03 commit were found.

## Behavior and files

| Files | Change |
| --- | --- |
| apps/api/src/quotation-request.js | Accept legacy flat or 1-20-part body; strict fields/string bounds/normalized IDs; duplicate rejection; stable canonical ID order while preserving legacy bytes |
| apps/api/src/draft-submissions.js | Remove obsolete single-part restriction; reuse all-part service/shared transaction/receipt |
| apps/api/src/auth/index.js | Bounded 64 KiB only for quotation POST UUID paths, retaining existing allowances and ordinary 4 KiB limits |
| apps/web/src/Workspace.jsx | Shared date, repeated stable-ID per-part controls, exact legacy/new pending recovery |
| apps/web/src/QuoteResults.jsx | Explicit persisted combined baseline annual value excluding GST; existing per-part/scenario/totals rendering reused |
| apps/web/src/styles.css | Two-column margin/routing layout using existing responsive rules |
| apps/api/test/quotation-api.test.js | Legacy frozen fingerprint, new/old one-part replay, two/three/max-part HTTP persistence, coverage/security/concurrency/rollback/history/recovery/size gates |
| tests/helpers/multipart-rfq.js | Disposable synthetic golden-derived input seeding and independent literal combined totals |
| tests/browser-quotation.smoke.js | Flat pending compatibility, real two/three-part golden save/reopen/refresh, lost-response recovery, ID-order mapping, mobile and read-only results |
| tests/browser-rfq.smoke.js | Replace obsolete multipart rejection expectation with manual intake-to-two-part quotation save |
| docs/decisions/0006-http-submission-idempotency.md; docs/decisions/0012-multipart-quotation-integration.md | Historical contract pointer and approved extended API/recovery contract |
| tasks/T03-multipart-quotations.md; docs/requirements.md; docs/current-status.md; docs/learning-log.md; docs/t03-handoff.md | Scope, traceability and verified handoff |

Existing POST /api/rfqs/:id/quote-versions accepts {pricingDate,parts:[{partId,routingRevisionId,marginPercent,tierQuantities}]} and the original flat body. All RFQ IDs must be covered once; array order is irrelevant. Response/replay/conflict remains 201/200/409. GET /api/quote-versions/:id already exposes annualValueExGst, all saved parts and three combined totals; React now labels the saved baseline explicitly. No new endpoint or migration.

The existing quotation service resolves every part/selected route/effective rate in one statement, calculates each component independently with the unchanged engine, then aggregates rounded unit-price × quantity lines. GST remains rounded once on the combined subtotal. No client-side prices/totals or financial policy changes. One transaction includes version counter, every immutable snapshot row and actor/key receipt. Incomplete IDs, wrong route, missing rate, invalid inputs or storage failure leave no partial version/key/counter changes. Replay precedes master validation.

Legacy flat pending bodies are displayed/resent without reshaping. The one-part canonical request retains the exact old fingerprint a847dc282987d7fb019d3a26f44c8ae4590a58e43a3624fd07b384bcc2fbd936 for the frozen spindle fixture. The equivalent new one-part body replays that receipt; multipart entry ordering is normalized before hashing. Saved history still comes exclusively from immutable snapshots. Authentication/current role, estimator-only writes, Origin, CSRF, process-local limiters and redacted failures remain.

## Actual checks

- npm.cmd test: 78/78; npm.cmd run test:costing: 33/33; npm.cmd run test:db: 104/104. All nine original goldens and saved expectations unchanged.
- Focused quotation HTTP suite: 22/22. Real two/three-part workflows verify all per-part golden tiers and three literal combined totals; 20-part request above 4 KiB succeeds. Missing/duplicate/foreign IDs, cross-part routes, missing rates/invalid values fail atomically. Tests cover concurrent reordered same-key replay, changed payload 409, later-part/receipt storage rollback, lost COMMIT acknowledgement, snapshot history and permissions.
- All six real Chrome suites passed: manual RFQ, Excel, AI association, AI intake, quotation and authentication. AI tests use mocks; no new live provider claim. Quotation Chrome checks two/three parts, grouped prices and combined totals, flat legacy recovery, uncertain multipart POST response/reload/200 recovery without duplicates, reordered saved-body controls by ID, read-only sales head and 390px layout. Manual-created two-part RFQ now also saves a complete quotation.
- check:api: 40 modules. node --check passed both changed browser scripts, multipart helper and quotation API test. Production build passed; test:production: 1/1.
- Initial test-only failures: the compact 20-part fixture was smaller than 4 KiB (extended with valid maximum-length numeric strings), and old manual browser test expected multipart rejection (replaced with positive complete-quotation behavior). No unresolved failing tests.
- Verification used disposable schemas/databases plus a generated test parent, removed afterward. Existing forgequote_dev/forgequote_test/other database data, grants and ownership were not modified. Build artifacts/screenshots/logs remain ignored in .tmp/dist, not committed.

## Limitations and stop

Selected routing remains the existing one-operation revision model; no arbitrary operation editor/interpreter. Intake and HTTP quotation bounds are 20 parts. Per-part input defaults/margins remain editable suggestions; all financial results originate on the server. Process-local limits and tab-scoped recovery limitations remain. Existing local runtime-owned auth tables/owner powers remain a deployment limitation; this milestone performs no ownership/grant repair.

No engine/golden/formula/aggregation policy, historical rate, snapshot schema/guard, migration, dependency, approval, PDF, deployment or push changes. Upcoming approval can use the already persisted combined baseline annual ex-GST value, but no approval decision is implemented. STOP after focused commit.

1. Why must exact RFQ coverage use normalized IDs rather than array positions or counts alone?
2. Why must quotation GST be calculated on the combined subtotal rather than summing rounded per-part GST?
3. Why must a legacy uncertain submission retain its original body/key even though the new UI supports parts arrays?

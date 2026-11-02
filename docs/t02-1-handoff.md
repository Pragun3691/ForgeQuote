# T02.1 manual RFQ handoff - 2026-11-03

Implemented only the approved manual intake slice. Branch feature/T02-ai-rfq-intake starts at 099131f, identical to latest local main; clean tree and ancestry verified first. Final commit/HEAD is reported with delivery. No push, deployment, purchase or Gemini work.

## Workflow

1. Sign in as estimator; choose New RFQ in the register.
2. Enter unique reference, synthetic customer and valid due date. Owner is signed-in username; status defaults open.
3. Add 1-20 parts: unique part number, description, gross kg, annual quantity, cycle minutes and setup hours/batch. Select all six real internal rate keys. No invented or preselected rates.
4. Confirm review and Save RFQ. Invalid inputs remain editable; editing resets review. Header, parts, revision-1 routes and receipt commit atomically. Register refreshes; Open RFQ displays every part.
5. After uncertain/network/503 failure, retain the tab and key/body; retry the locked submission. Refresh, reopen New RFQ and retry if needed. A committed original save returns its existing ID. Create another RFQ explicitly starts new intent after success.
6. One-part RFQs work with existing quotation costing. Multiple-part RFQs can be created/read, but existing costing HTTP/UI visibly supports one part only, as before.

## API and database

- New GET /api/rfq-rate-keys: authenticated lookup IDs/codes/categories/units, no resolved money values.
- New POST /api/rfqs: estimator, Origin, X-CSRF-Token and UUID Idempotency-Key. Body {reference,customerName,dueDate,parts}; part {partNumber,description,grossWeightKg,requestedAnnualQty,cycleTimeMin,setupHoursPerBatch,rateKeys}. rateKeys contains exactly material/machine/scrap/overhead/packaging/freight. Decimal/quantity values are strings.
- Receipt {rfqId,replayed}; 201 new/200 replay, Location: /api/rfqs/:id. 400 invalid, 401 anonymous/inactive, 403 role/CSRF/Origin, 409 key/reference conflict, 413 too large, 429 limited, 503 redacted failure. Retain original key/body for uncertain/limited attempts.
- Migration 005 adds immutable rfq_submissions with actor/key primary key, fingerprint, unique RFQ foreign key and default created_at. Existing tables hold header/parts/routes. Minimum column INSERT grants; no status/timestamp override, rate editing or ownership changes. Readiness/permission checkers advance to 005.
- 005/grants applied only in disposable fixtures, not existing development/public schemas. For local existing development after review: npm.cmd run db:migrate, npm.cmd run db:grant-runtime, npm.cmd run db:check-permissions, then build/start using existing configuration. Ordinary grants do not resolve the previously disclosed local ownership limitation.
- Migrations 001-004, financial engine/spec and all nine golden expectations have no diff from baseline.

## Tests and evidence

- npm.cmd test: 46/46 passed, including 33 costing tests and all nine independent goldens.
- npm.cmd run test:db: 63/63 reported passed (57 subtests + six parents). Twelve new intake subtests cover auth/CSRF/Origin/role, validation, wrong-category/missing keys, multi-part persistence, canonical replay/conflict, six concurrent retries, second-route and receipt rollback, lost COMMIT acknowledgement, 20-part body limit, one-part golden costing and restrictive column/receipt privileges.
- Focused fresh-database test also verifies intake creation/replay using actual restricted non-owner LOGIN credentials, strict grants and 27-trigger inventory.
- npm.cmd run check:api: 32 modules passed syntax checks.
- npm.cmd run build: passed; initial sandbox Vite/esbuild parent traversal failed, approved outside-sandbox build succeeded.
- npm.cmd run test:production: 1/1 passed.
- Existing npm.cmd run test:browser and test:browser:quotation: passed in real Chrome, including session/restart/quote recovery and saved goldens.
- New npm.cmd run test:browser:rfq: passed in real Chrome with disposable local PostgreSQL. Duplicate-part validation/correction, multi-part save, committed-response loss, refresh/exact-key-body retry, one persisted RFQ, register/detail, unchanged one-part golden cost 119.76/price 149.70, 390px no-overflow and sales-head read-only UI. Desktop/mobile .tmp screenshots visually inspected.
- Initial failures: wrong test fixture code corrected against tracked seed; old four-migration inventory updated to 005; explicit accessible rate-selector label added; price assertion corrected for existing rupee prefix. No golden changed.

## Exact changed files

- apps/api/db/migrations/005_rfq_intake.sql
- apps/api/db/runtime-grants.sql
- apps/api/package.json
- apps/api/scripts/check-permissions.js
- apps/api/src/app.js
- apps/api/src/auth/index.js
- apps/api/src/cloud-database.js
- apps/api/src/errors.js
- apps/api/src/rfq-intake.js
- apps/api/src/rfq-routes.js
- apps/api/test/cloud-database.test.js
- apps/api/test/database.test.js
- apps/api/test/quotations.test.js
- apps/api/test/rfq-intake.test.js
- apps/web/src/RfqCreate.jsx
- apps/web/src/Workspace.jsx
- apps/web/src/styles.css
- tests/browser-rfq.smoke.js
- package.json
- README.md
- docs/current-status.md
- docs/requirements.md
- docs/learning-log.md
- docs/decisions/0008-manual-rfq-intake.md
- docs/t02-1-handoff.md
- tasks/T02-rate-history.md
- tasks/T02-ai-rfq-intake.md

## Limits and preparation for T02.2

No AI implemented or claimed verified. No SDK/key/provider access, upload, Excel/text-PDF intake, approval, quotation PDF or rate editor. Reviewed manual schema/service is the next extraction proposal's save boundary; AI cannot calculate costs or bypass review. T02.2 must verify provider terms, enforce synthetic/nonconfidential Free use, configure initial gemini-3.5-flash-lite, check structured fields/literal evidence and verify the real provider. STOP pending owner approval.

One operation/part; no RFQ editing/pagination/tenant isolation; both demo roles read all RFQs. Process-local limiter; tab storage may be lost; unsent edits not autosaved. Past due dates allowed; case-sensitive references; positive weight/cycle intake assumption. Keys do not guarantee historical rates. Service/private credentials guarantee assembly/receipt correspondence (ADR-0008). No existing development migration or public deployment occurred.

## Owner understanding questions

1. Why must header, every part/route and retry receipt share one transaction?
2. How does original key/body replay recover a successful save whose response was lost, and why does changed content conflict?
3. Why select rate keys during intake but resolve historical values at the quotation pricing date?

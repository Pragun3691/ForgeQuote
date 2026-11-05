# Final requirements handoff - 2026-11-05

Branch feature/final-requirements, base fd3e7c2. Continued and preserved all interrupted work. The final local commit hash is reported in the completion message. No existing commit was rewritten. Author and committer emails are checked immediately before commit against pragunaggarwal36@gmail.com.

Completed: Sales Head append-only effective-dated rates on existing keys; derived estimating/sent/won/lost RFQ register with assigned estimator and attributed terminal history; confidential internal costing PDF for both active roles and all historical saved versions. Financial formulas/goldens, ownership, quotation events and existing customer PDF projection/renderer/eligibility are unchanged.

## Endpoints and storage

- POST /api/rates/:id/versions: Sales Head, CSRF/Origin, UUID Idempotency-Key; value/effectiveFrom/reason, six-place raw decimal validation; date >= Asia/Kolkata today and > latest key start. 201 new / 200 replay; 400 invalid / 403 role / 404 key / 409 date or intent conflict. Catalogue now includes actor ID/reason and writer capability.
- POST /api/rfqs/:id/outcomes: Sales Head, same request protection; won or lost with reason; actual issuance required. 201/200 replay; terminal or changed-intent conflict 409. Register/detail derive status and display existing assigned estimator. No mutable ownership/status migration.
- GET /api/quote-versions/:id/internal-pdf: active Estimator/Sales Head, saved-only internal inputs, costs, margins, rate provenance, quantities, formula and illustrative GST/totals. Historical/unissued versions allowed. No-store authenticated attachment, repeated INTERNAL / CONFIDENTIAL, shared bounded PDF rate limiter, 8 MiB/100-page/font/layout limits. Customer GET .../pdf behavior stays unchanged.

Migration 007 preserves all old rows/snapshots, adds rate raw/provenance/reason/request fields and a guarded append-only rfq_outcomes table. New column INSERT grants exclude rate value/created_at and outcome occurred_at; no new UPDATE/DELETE/TRUNCATE/ownership or blanket grants. Cloud checker expects 18 tables, seven functions, 34 enabled triggers and exact columns. No new dependency or environment setting. New app readiness requires 007; future deployment must apply the pending migration and reviewed grants first. No cloud action performed.

## Changed files

- Database/security: apps/api/db/migrations/007_final_requirements.sql, apps/api/db/runtime-grants.sql, apps/api/scripts/check-permissions.js, apps/api/src/cloud-database.js.
- Backend: apps/api/src/final-workflows.js, internal-costing-pdf.js, quotation-routes.js, rate-catalogue.js, rfqs.js, errors.js, app.js.
- Frontend: apps/web/src/FinalWorkflows.jsx, RateCatalogue.jsx, QuoteLifecycle.jsx, Workspace.jsx.
- Tests/scripts: apps/api/test/final-workflows.test.js, cloud-database.test.js, database.test.js, quotations.test.js, rate-catalogue.test.js, rfq-intake.test.js; tests/browser-final-workflows.smoke.js, browser-rates-ux.smoke.js; root and API package.json.
- Documentation: README.md, docs/current-status.md, requirements.md, deployment.md, learning-log.md, this handoff, ADR-0017 and tasks/final-requirements.md.

## Verification

- Unit/config/parser/customer-PDF: 82/82. Dedicated costing: 33/33 including all nine unchanged golden cases.
- PostgreSQL/API: 137/137 reported results, including 14 top-level parents. Fresh disposable local parent databases only; no existing development/test migration or grant operation. Real restricted LOGIN cloud-permission setup/check tests passed locally.
- Ten Chrome suites: auth, quotation, manual RFQ, mocked AI, Excel, mocked numbered association, lifecycle, customer PDF, rate/intake UX, new final workflows. All passed. New suite exercises committed-response-loss + refresh + exact-key retry for rates/outcomes, historical internal download, register status, role restrictions and 390px layout.
- Syntax: 46 API modules plus changed/new test/browser scripts. Vite production build and production startup 1/1 passed.
- Internal PDF: independent PDF.js content/geometry checks, all expected saved costs/provenance/totals, historical both-role downloads, byte-identical saved rendering after rate changes, no attachments, missing-data rejection and long 20-component pagination. Rasterized and visually inspected the four-page sample. Final PDF-focused PostgreSQL rerun 9/9 passed. Existing customer PDF content/confidentiality and browser suites passed unchanged in behavior.

Initial checks caught and corrected old open-status assertions, invalid JSX, misplaced/denied internal download, rate-select accessibility and footer pagination. An initial build needed normal filesystem access; browser suites overlapping a rebuild were resumed after build completion. Final passes above supersede those failed attempts.

## Limits and owner questions

Local commit only; migration 007/grants and deployment remain unapplied to Neon/Render. Existing two-role global synthetic-demo reads, trusted runtime actor attribution, process-local limits and finite bundled-font coverage persist. Legacy rates retain unknown authors. No rate key creation, backdating, future-version cancellation, outcome reopening/reassignment, supplier provenance or RFQ PDF intake. Terminal history has one final outcome per RFQ. Saved historical rates contain effective starts, not exclusive ends; report does not consult today's masters to invent an end.

1. Why must raw decimal validation happen before PostgreSQL NUMERIC(18,6) coercion, and why does runtime lack INSERT(value)?
2. Why does an issued historical version keep an RFQ sent when a newer draft exists, and why can only one terminal outcome be appended?
3. Why can a superseded version download an internal report while its customer PDF remains unavailable, and which snapshot fields make that safe?

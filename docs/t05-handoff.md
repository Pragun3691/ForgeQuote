# T05 handoff - customer quotation PDF

Branch: feature/T05-quotation-pdf from clean main 47e226e, confirmed merged and identical to fetched origin/main on 2026-11-05. Owner approved focused implementation/tests/commit without another plan round. No push, merge, deployment or cloud access.

## Implemented

Authenticated GET /api/quote-versions/:id/pdf, available to both active demo roles only for an issued, current quotation version. Server derives eligibility from stored lifecycle history and locks the existing quotation header through snapshot reads and PDF assembly. All unissued states (including approved but not issued), rejected and stale versions are denied. The stored quotation number, issue timestamp and exact version ID bind the document. A download writes no snapshots or events.

Customer PDF includes stored customer name/RFQ reference, issue date in IST, saved pricing date, all components/descriptions, all 50/100/150 scenario quantities, selling unit prices and stored line/quotation totals. Saved GST percentage/amount and total including GST are separate and explicitly illustrative. An allowlisted projection excludes internal costing/rates/margins/routing/provenance/actors/reasons and has no hidden snapshot attachment or internal metadata. No financial arithmetic is performed by the renderer: monetary values are saved decimal strings formatted with Indian grouping and rupee.

Professional A4 output uses embedded/subset OFL Noto Sans Regular/Bold, repeated branding/continuation headers, wrapped rows, readable totals and exact-version/page-count footers. Optional draft preview is omitted. The existing lifecycle panel offers Download customer PDF only when eligible, with loading/error/retry handling and authenticated browser download.

## API and failures

200 application/pdf with Content-Disposition attachment; filename FQ-<stored version UUID>.pdf, Cache-Control no-store, X-Content-Type-Options nosniff. 400 invalid UUID, 401 unauthenticated/inactive, 403 role forbidden, 404 missing version, 409 PDF_NOT_ISSUED or STALE_QUOTATION, 422 PDF_INVALID_SNAPSHOT/PDF_UNSUPPORTED_TEXT, 429 process-local 20 requests/actor/15 minutes, redacted 503 for unexpected rendering/storage failure. GET makes no business mutation and needs no new CSRF/idempotency key; existing write controls remain unchanged. Query/client price/GST overrides have no effect.

## File manifest

- apps/api/src/customer-quotation.js: transactional eligibility, customer allowlist, reuse of saved snapshot/lifecycle readers and PDF assembly.
- apps/api/src/quotation-pdf.js: PDFKit A4 layout, exact decimal formatting, pagination, font coverage and bounded buffering.
- apps/api/src/quotation-routes.js and errors.js: protected download/limiter and controlled errors.
- apps/api/src/quotations.js and quotation-lifecycle.js: optional internal shared-client reads only; no creation, calculation, lifecycle-transition or event-write change.
- apps/api/assets/fonts/: unmodified Noto Sans Regular/Bold, OFL.txt and source/hash README.
- apps/web/src/QuoteLifecycle.jsx: customer PDF button/download/error handling; no redesign.
- apps/api/test/quotation-pdf.test.js, quotation-pdf-api.test.js; tests/helpers/pdf.js and pdf-fixture.js; tests/browser-pdf.smoke.js: independent parser/layout/API/history/browser verification.
- Root/API package.json and package-lock.json: pinned pdfkit 0.20.2, fontkit 2.0.4, dev-only pdfjs-dist 6.5.438 and test scripts. No unrelated existing dependency upgrade.
- README.md, docs/current-status.md, requirements.md, deployment.md, learning-log.md, decisions/0015-customer-quotation-pdf.md, tasks/T05-quotation-pdf.md and this handoff.

## Verification

All database operations used uniquely named disposable local parents/fixtures with a localhost guard; generated schemas/roles/databases were cleaned up. No existing development/test database or Neon migration/grant/data change.

- npm.cmd test: 82/82 passed, including four independent PDF content/layout/confidentiality tests. All nine original financial goldens unchanged.
- Complete test:db file list including quotation-pdf-api.test.js, run in a disposable parent: 122/122 passed. Real restricted PostgreSQL/session checks cover both roles, all denied states, exact issued number/version/dates, unchanged snapshots/events on GET, multipart golden prices/combined totals, no internal-field/attachment leakage, identical PDF bytes after live master/customer/config changes, superseded historical versions and disabled sessions.
- npm.cmd run test:costing: 33/33 passed. Existing saved multipart goldens also passed in database suites.
- All eight Chrome suites passed: auth, quotation, RFQ, AI, Excel, numbered-part association, lifecycle and PDF. New test downloads an actual three-part issued attachment for both roles, verifies filename/rupee/exact combined baseline totals, exercises a visible temporary-download failure and retry, mobile layout and hidden download after supersession. AI regressions use mock providers; no live provider/cloud request.
- npm.cmd run check:api: 43 source/maintenance modules; changed test-script syntax; production Vite build; npm.cmd run test:production: 1/1 actual local production startup; git diff --check all passed. Package installs reported zero known vulnerabilities.
- Independent PDF.js extraction checks currency glyphs, font embedding/ToUnicode, exact text/totals, A4 geometry, margins, pagination and no orphan scenario headers. A 20-component long-description/large-decimal stress sample spans 32 pages. Single-component and actual three-component documents span two pages. All final pages were rasterized and visually inspected with independent PDFium (ignored local test tool); samples/PNGs are in .tmp/t05-pdf/. No runtime renderer binaries or Python dependency.

Initial test-helper cleanup used an obsolete PDF.js document destroy API; updated to loading-task destroy. Visual QA prompted measuring the first row before placing a new scenario heading; a regression assertion now checks content after each final heading. The first PDF.js/native-canvas raster pass omitted repeated header glyphs on some continuation pages despite their text being present; independent PDFium rendering confirmed correct final PDF appearance. Full final checks pass; no unresolved test failure.

## Deployment and known limits

No migration or grant change. Existing migration 006/lifecycle tables remain the prerequisite inherited from T04. Deploy packaging must include committed apps/api/assets/fonts files and npm locked runtime dependencies; no Render setting, executable install or new environment variable is needed for this PDF path. T05 is local-only and not deployed. No Neon/Render access/change, push or merge.

Stale issued snapshots remain readable and historically issued but this endpoint denies a final PDF once superseded; previously downloaded documents cannot be retracted. No preview, stored PDF archive, digital signature, address/GSTIN/payment/validity terms or invoice-tax compliance is invented. Font coverage is finite; unsupported glyphs give a visible error. At most 20 components/scenario, 40 pages and 4 MiB, with a process-local download limiter. Header read locking can briefly delay a new version while rendering. Broader scripts, archival delivery and deployment are separate work. Actual blockers for the approved local stage: none.

## Owner understanding questions

1. Why must a PDF use the issued event's quotation number/date and saved scenario totals rather than current RFQ/rate/configuration values?
2. How does the explicit customer allowlist prevent leakage even though the internal saved snapshot contains costs, margins and rate provenance?
3. Why does the download service share the quotation-header lock and transaction with its readers, and what happens if a newer version committed first?

STOP after the focused T05 commit.

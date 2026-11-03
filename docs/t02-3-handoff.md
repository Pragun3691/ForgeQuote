# T02.3 Excel import handoff - 2026-11-03

Branch: feature/T02-ai-rfq-intake. Started clean at owner-specified fad3d79. Scope: Excel vertical slice only; read-only PDF feasibility assessment. No deployment, purchases, PDF implementation or additional milestones.

## Shutdown recovery and fresh verification

Recovered on 2026-11-03 from feature/T02-ai-rfq-intake at fad3d794fc83459d992ed46fb418695abe9e57dd. No final T02.3 commit existed. All intended implementation/dependency/example/test files and draft docs survived: 12 tracked modifications and 11 untracked files. No work was reset, discarded, recreated or overwritten from another branch. Application implementation was complete; the only remaining code correction was test-only: the Excel example-download check now uses the absolute ephemeral server Origin, because page.request had no baseURL.

Fresh execution after recovery (not inherited reports): npm.cmd test 70/70; npm.cmd run test:db 80/80 reported results including parser endpoint/security/real restricted LOGIN permission tests; npm.cmd run check:api 40 modules plus node --check for the Excel browser/fixture scripts; production build passed; npm.cmd run test:production 1/1; npm audit zero known vulnerabilities. All nine financial golden expectations remain unchanged and pass both engine and snapshot checks. No existing development database was modified/reset; fixture migrations/data/roles were isolated and cleaned up by the existing test helpers.

Browser execution first failed in test:browser:xlsx with apiRequestContext.get Invalid URL at its new download assertion. After the one-line test-only correction, all five suites passed in sequence: test:browser:xlsx, test:browser:rfq, test:browser:ai, test:browser:quotation and test:browser. Excel now also checks that the downloaded example bytes match the synthetic fixture. Updated mobile screenshot was visually inspected. No remaining failing regression was observed.

The checked-in npm.cmd run test:ai:live also PASSED against unchanged gemini-3.5-flash-lite with the existing configured key and synthetic fixture. Excel browser tests separately assert zero Gemini calls. Full diff/23-file review found no protected finance/migration/history/save-service edits and no exact current secret literals in changed/new files; this bounded scan is not a universal secret-detection guarantee. No credential or raw provider response was printed. No PDF implementation, push or deployment.

## Separate unresolved Gemini manual-QA finding

Owner-reported manual QA: a synthetic two-part RFQ containing SP-101 and BR-202 produced four suggested parts with unsupported associations. This is an unresolved T02.2 Gemini finding, separate from deterministic Excel import. The complete source/request and a captured response were not provided for reproduction in this recovery run. No Gemini correction or model/prompt/evidence change was made. Passing the standard live fixture does not resolve this case; require separate approval to investigate/fix it.

## Supported template and usage

Use the UI's Download synthetic Excel example (apps/web/public/synthetic-rfq.xlsx). Select Import Excel part list, choose a synthetic .xlsx, attest that it is nonconfidential and contains no actual personal data, then Review Excel import. This makes no Gemini call and saves no RFQ. Compare stored values, normalized values, worksheet name, original cell and header-cell evidence. Use imported parts replaces parts, clears rate keys and review confirmation, and preserves reference/customer/due date. Complete missing manufacturing values, select real internal keys, correct values and explicitly confirm the existing form before saving. Existing atomic RFQ creation, idempotency and uncertain-save/sessionStorage recovery remain unchanged. On parse failure/cancel, existing manual fields remain; Gemini pasted-text intake remains available.

Normal transitional OOXML .xlsx only. One populated visible worksheet (up to five declared sheets; other sheets must be blank and visible). Row 1 is the header; subsequent nonblank rows are individual parts. Up to 20 parts, physical row 100 and column AF (32). Supported headers, case-insensitive with surrounding whitespace trimmed:

| Required | Optional |
|---|---|
| Part number | Material |
| Description | Cycle time (min) |
| Gross weight (kg) | Setup hours per batch |
| Annual quantity | |

Columns may be reordered/nonadjacent. Sparse rows/cells use explicit worksheet row/cell references. Standard shared strings, inline strings and simple rich text runs are supported. Missing required values, unknown/duplicate headers, duplicate part numbers, conflicting/invalid values or nonempty extra columns reject the entire import. Blank rows may be skipped; invalid records are never partially imported.

Text identifiers/descriptions must be text cells; numeric-looking part numbers must be stored as text to preserve leading zeros. Input text lengths match the manual form (material up to 160). Numeric inputs may be numeric cells or literal text tokens, with no grouping, units, exponent, signs or surrounding spaces. Decimals: up to 12 integer and six fractional digits; weight/cycle positive, setup nonnegative. Annual quantity is an integer from 1 to 1000000000. Plain General numeric format is supported; typography may vary. Dates, percentages, currency/custom numeric formats and inherited nondefault row/column styles are rejected. Material stays customer text in review; it never selects an internal rate key.

Unsupported: .xls/.xlsm/.xlsb/CSV/ODS, Strict OOXML, encrypted/password-protected workbooks, macros/embedded binary objects, external relationships, formulas (including cached/shared/array formulas), error/boolean/date cells, merged cells, hidden sheets/rows/columns/default-hidden rows, filtered/protected tables, multiple populated sheets, phonetic/richer unsupported string layouts, arbitrary customer templates and column mapping. The current UI reports controlled template/limit errors and offers manual entry; it is not an Excel interpreter. The example is built from an independent test fixture writer, not an installed Office application; it was parsed/downloaded through our workflow, not interactively verified in Microsoft Excel.

## Numeric precision

The parser reads OOXML numeric <v> text without Number/parseFloat conversion. Integer/decimal token validation and normalization use strings; BigInt checks the quantity bound. For example stored 0.610000 remains raw 0.610000 with normalized 0.61; stored 999999999999.123456 remains exact. Number conversions are limited to bounded cell/style/shared-string indexes. No manufacturing/financial value enters binary floating-point arithmetic. No rounding, quantity inference or formula evaluation occurs. Precision already lost when Excel originally saved a numeric cell cannot be recovered, and display formatting is not treated as source truth.

## Endpoint, bounds and privacy

POST /api/rfq-import/xlsx accepts raw bytes with exact Content-Type application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, X-File-Name ending .xlsx, X-Synthetic-Only:true, existing session cookie, exact Origin and X-CSRF-Token. The UI sends the fixed transport filename synthetic-rfq.xlsx rather than a potentially identifying customer filename. Header extension/MIME checks are preliminary; ZIP, OOXML content types, workbook relationships and actual worksheet structures are independently checked. JSON parsing is bypassed only for this exact binary POST; existing route limits/authentication are preserved. No database migration, grant or endpoint save contract changed.

Authentication, current estimator role, CSRF, rate/type/attestation and concurrency checks precede buffering/parsing. Limits: 2 MiB compressed bytes, 100 ZIP entries, 20 MiB declared AND actual total expansion, 20000 XML nodes per parsed XML, XML depth below 24 and text-node bounds. ZIP entry sizes/checksums/paths and relationship targets are checked. XML DTD/entity declarations, malformed XML and external relationships reject without external fetches. Parser runs in a terminable Node worker, with 128 MiB old/16 MiB young heap limits, a three-second parser deadline and cancellation on client disconnect. These are worker heap limits, not an OS/container memory guarantee. Total upload/parser route deadline is 15 seconds. No extraction to disk and no server document storage.

Five attempts/estimator/15 minutes and two in-flight requests per process. Busy attempts count against the attempt limit; CSRF failures do not. Process-local limits reset on restart and need shared coordination before scaling. Errors: 400 attestation, 401 login, 403 role/CSRF, 413 upload/archive bounds, 415 type/encoding, 422 invalid/unsupported workbook, 429 busy/rate, 504 timeout, 408 cancellation where a response remains possible, 503 unexpected import failure. Fixed messages/codes only; no raw ZIP/XML/parser errors, document text or credentials in logs. Source/evidence remain transient; confirmed form fields use existing sessionStorage and RFQ persistence.

## Dependencies and verification

Pinned server-only yauzl 3.4.0 (MIT, Node >=12) and saxes 6.0.0 (ISC, Node >=12.22.7), compatible with Node 24.20.0. Four packages added including pend and xmlchars. No install scripts in these new packages; saxes is a small established parser with an archived upstream repository, a maintenance risk to revisit before broader untrusted production uploads. npm audit completed with zero known vulnerabilities (a point-in-time advisory check, not proof of safety).

Tests were written first and initially failed because the parser module did not exist. Final results:

- npm.cmd test: 70/70 passed, including all nine unchanged financial goldens and existing AI/numeric/evidence regressions.
- npm.cmd run test:db: 80/80 reported results passed. New import tests use a new disposable local database and verify denial before parser, exact real worker output, zero business writes, logging redaction, rate/concurrency limits and disconnect/manual continuation. Existing snapshot/rate/auth/RFQ tests passed.
- All five real Chrome suites passed: authentication, quotation, manual RFQ, Gemini review (mock provider), Excel import. Excel covers exact cell evidence, attestation, review/correction/keys/confirmation reset, confirmed save, lost committed response/refresh/same-key recovery, formula failure/manual fallback, zero Gemini calls and 390px layout. Desktop/mobile screenshots .tmp/t02-xlsx-*.png were inspected.
- Production frontend build passed after the workspace sandbox prevented Vite config resolution; the authorized normal-access rerun succeeded. API syntax: 40 modules. Actual production startup: 1/1 passed.
- Parser cases include exact six-place/extreme accepted decimals, shared/inline/rich strings, sparse/reordered references, formulas with cached values, unsupported/missing/duplicate headers/parts, numeric style rejection, hidden/multiple sheets, XML entities, external relationships, expansion/count/checksum limits, worker timeout and cancellation.

No actual customer documents or credentials used in fixtures/logs. Financial formulas/spec/golden fixtures, historical rates/snapshots, migrations 001-005, existing ownership and confirmed-save service were not edited.

## Read-only PDF assessment and recommendation

No PDF package installed, no PDF route/UI/parser implemented and no PDF document sent to Gemini. npm metadata on 2026-11-03: pdfjs-dist 6.5.438 requires Node >=22.13.0 or >=24, is 37616588 bytes unpacked and lists optional @napi-rs/canvas ^1.0.13. The Node 24 engine matches, but actual canvas-free module/runtime compatibility has not been executed or established.

Mozilla's Node example uses legacy/build/pdf.mjs, getDocument and per-page getTextContent, so the existing Gemini adapter, strict schema, evidence verifier and review/save boundary can be reused after bounded text extraction. A future feature still needs authenticated binary upload, synthetic/provider consent before contact, page/offset mapping, reading-order handling, encrypted/image-only rejection, deadlines/cancellation, parser security checks and real synthetic PDF tests. Existing literal label/part rules must not be weakened or invented to accommodate PDF layouts. Native canvas is referenced by PDF.js Node support/polyfills; a no-render text path needs an explicit compatibility gate.

Sources: https://raw.githubusercontent.com/mozilla/pdf.js/master/examples/node/getinfo.mjs and https://raw.githubusercontent.com/mozilla/pdf.js/master/src/display/node_utils.js plus npm view pdfjs-dist metadata. Recommendation: defer PDF intake pending explicit approval and a capped compatibility spike; avoid putting remaining assignment time at risk. RFQ PDF intake is separate from later final quotation PDF generation, which remains required/planned.

## Manifest and stop

Exact checkpoint file manifest (23 files):

- README.md
- apps/api/package.json
- apps/api/src/app.js
- apps/api/src/auth/index.js
- apps/api/src/errors.js
- apps/api/src/imports/routes.js
- apps/api/src/imports/worker.js
- apps/api/src/imports/xlsx.js
- apps/api/test/fixtures/xlsx.js
- apps/api/test/xlsx-api.test.js
- apps/api/test/xlsx.test.js
- apps/web/public/synthetic-rfq.xlsx
- apps/web/src/RfqCreate.jsx
- apps/web/src/RfqDocumentImport.jsx
- docs/current-status.md
- docs/decisions/0010-excel-rfq-import.md
- docs/learning-log.md
- docs/requirements.md
- docs/t02-3-handoff.md
- package-lock.json
- package.json
- tasks/T02-ai-rfq-intake.md
- tests/browser-xlsx.smoke.js

Remaining: text PDF intake, general document layout support, broad manufacturing inference and persistent source audit are absent. Existing one-part HTTP quotation costing, pending approvals/final quotation PDF/rate editor/deployment, local ownership limits and global demo read scope remain. No additional milestone started. STOP for approval before PDF implementation.

Owner understanding checks:
1. Why does reading the stored numeric XML token avoid a JavaScript floating-point round-trip, yet fail to restore precision Excel already lost?
2. Why must cached formula values, ambiguous styles and invalid rows reject rather than silently populate a saved RFQ?
3. Which actions only produce review suggestions, and which unchanged confirmed/idempotent transaction actually saves the RFQ?

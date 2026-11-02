# T02.2 Gemini extraction handoff - 2026-11-03

Branch: feature/T02-ai-rfq-intake. Started clean at the expected 63ada4513758d9798782f0ecac15696166148e8d. Implementation commits: 04ad325 (SDK, schema, evidence verifier, API/tests/policy) and 5d98784 (review UI/browser tests). Documentation commit follows; final HEAD is reported with delivery. No push/rebase/branch overwrite.

**LIVE PROVIDER TEST NOT RUN.** No AI_API_KEY, GEMINI_API_KEY or GOOGLE_API_KEY was configured locally. The genuine-test command ran and explicitly reported missing AI_API_KEY. All provider responses in automated unit/HTTP/browser tests were mocked, including the official SDK transport test. Real Gemini connectivity, this project's quota/access and actual model extraction quality remain unverified. This is implemented integration code, not a claim of live AI completion.

## Provider configuration and local setup

Official @google/genai 2.32.0 and Zod 4.6.7 are pinned in the API workspace/lockfile. Initial AI_MODEL is gemini-3.5-flash-lite. SDK is explicitly Developer API, server-only key, no tools/ADC/Vertex/alternate-model fallback. Provider terms/policy, verifier rules and reliability decisions: [ADR-0009](decisions/0009-gemini-extraction.md).

1. Use existing Node 24/PostgreSQL configuration and T02.1 schema 005. T02.2 has no new migrations or grants. Existing development schema was not changed; if 005 is still pending, use the already documented maintenance migration/grant commands before running manual saves.
2. Run npm.cmd ci. In ignored root .env set AI_API_KEY privately to an unpaid Gemini project key; no secret value belongs in this document, React, a VITE_ variable or Git. The project intentionally reads AI_API_KEY, not implicit SDK key aliases.
3. Optional nonsecret settings: AI_MODEL=gemini-3.5-flash-lite and AI_TIMEOUT_MS=20000. Deadline range is 1000-30000 milliseconds. Missing/blank key disables extraction only; invalid model syntax/deadline also leaves manual intake available. Restart the API after environment changes. No billing activation or paid key/service setup is authorized.
4. Run npm.cmd run dev:api and npm.cmd run dev:web with the existing exact APP_ORIGIN/session configuration; or build/start on the configured same origin. Login as estimator and select New RFQ.
5. Only after privately configuring an unpaid project key, run npm.cmd run test:ai:live. It uses the tracked synthetic-rfq fixture, real SDK/adapter and bounded output without logging source/secrets. It can make one transient retry within the deadline. Missing key is explicitly NOT RUN; configured failures report a safe code, never a false success. No key was added in this checkpoint.

## Actual extraction/review/save flow

- Expand Extract from text with AI (optional). Manual fields remain available without using AI.
- Paste up to 12000 characters of synthetic nonconfidential email/text. Read the Google unpaid-service disclosure; independently confirm synthetic/no personal data and consent to sending to Google. Editing source clears both checkboxes and the earlier review result.
- Extract with AI performs a protected server call. Loading disables edits/save; cancellation aborts the client request and returns to manual fields. Missing configuration/provider quota/access/model/timeout/response errors are visible, with Continue manually. No mock response or silent provider fallback exists in production code.
- Inspect every raw suggestion, normalized value, exact quote, server-computed location and verified/ambiguous/unsupported/missing label. Wrong-part evidence, unsupported values and absent fields cannot populate the form. Material text is shown for manual key selection; AI never chooses keys or rates.
- Use verified suggestions deliberately replaces current form headers/parts. It copies verified normalized business values only; other values and all rate-key selects remain empty. Existing confirmation resets. Correct values, fill missing manufacturing facts and select real internal keys.
- Confirm manual review and Save RFQ through unchanged POST /api/rfqs. Existing T02.1 schema/category validation, atomic header/parts/routes/receipt and same-key recovery remain authoritative. Open the saved record from the existing register. Extraction itself never writes an RFQ or quotation.
- Full source/evidence are transient request/browser state and disappear on refresh/logout. Reviewed business facts use normal RFQ storage; T02.1 pending save key/body survives refresh as before. Extraction has no exactly-once provider guarantee; re-extraction may consume quota again.

## API and evidence verification

GET /api/rfq-extraction and POST /api/rfq-extraction require an active estimator. GET returns only provider/model/configured status; available is not a live-connectivity claim. POST additionally requires exact Origin and session CSRF; body is exactly {sourceText,consent:true,syntheticOnly:true}. No persistence schema or permission additions.

Response includes provider/model, rfq fields, parts and warnings. Fields contain rawValue, normalizedValue (or null), status, evidence and issues. Each evidence item carries quote, found/inScope, start/end UTF-16 offsets (zero-based/end-exclusive) and one-based lineStart/lineEnd; ambiguous/missing locations are null. Parts include the model anchor and independently resolved sourcePartIndex. Provider schema permits only explicit raw facts/status/quotes; unexpected prices, confidence and internal keys are rejected.

The verifier independently segments explicit Part:/Part number:/Item: headers. Header facts must precede the first part. Quotes must occur verbatim and uniquely in the correct section. A raw value must equal the complete value on a recognized matching labeled line and appear in evidence on that line. Numeric parsing consumes the entire token and supported unit: 61 does not support 610. decimal.js performs exact kg/g, time and annual-count normalization; repeating/over-precision conversions are rejected rather than rounded. Setup requires explicit per-batch wording. Valid ISO or named-month dates normalize deterministically.

Conflicting recognized labeled values are ambiguous independently of model status. Revision/uncertainty markers conservatively block the section. Unknown/duplicate anchors and wrong-part evidence are unsupported. Omitted source parts become visible missing placeholders. Model ambiguity remains ambiguous. Unlabeled narrative, arbitrary units/languages and general semantic contradictions are not automatically proven; manual correction is the honest fallback. Verified means these literal rules passed, not approval or proof the source facts are true. See ADR-0009 for aliases/bounds and trust limits.

## Reliability and privacy

- Input: 12000 characters, 64 KiB JSON, max 20 parts. Output: 8192 tokens and 65536 UTF-8 bytes; incomplete/blocked/truncated/invalid structured output fails visibly.
- Total default deadline 20 seconds, including optional 250 ms retry delay. At most one transient retry (HTTP 500/502/503/504 or network TypeError). SDK attempts:1 and automatic continuation off. No automatic quota/access/model/schema/timeout retry and no browser background retries.
- Five attempts/estimator/15 minutes and two in-flight extractions per process; manual RFQ limits are separate. No distributed limiter infrastructure added.
- Safe codes distinguish 400 input, 403 role/CSRF, 422 instruction tripwire, 429 quota/local limit/busy, 502 invalid provider output, 503 missing/invalid config or provider access/model/network failure, 504 timeout and 408 interrupted extraction when a response is possible. Client disconnect aborts the SDK signal; provider-side work already submitted may continue.
- Source is isolated as untrusted data; no tools, source execution, keys in prompts or provider HTML rendering. Selected obvious injection patterns are rejected before contact. No general injection-proof or semantic-truth claim.
- Existing allowlist application logs exclude pasted text, quoted evidence, cookies/tokens, keys and raw provider exceptions. Tests verify this. Built React assets contain neither server SDK/prompt fields nor key variable names/test-key marker. Credentials remain ignored; no actual key was read into outputs or committed.
- Unpaid use is restricted to the disclosed synthetic, nonconfidential demo. Consent is an attestation, not automated confidentiality classification. The operator must use an unpaid project; no billing API, purchase, new service account or deployment occurred.

## Executed tests and results

| Check | Actual result |
|---|---|
| npm.cmd test | 61/61 passed, including 15 new AI tests, 33 costing tests and all nine independent goldens |
| npm.cmd run test:db | 75/75 reported passed: 68 subtests + seven parents, real disposable PostgreSQL |
| Focused latest AI schema/evidence/provider unit run | 15/15 passed, including explicit per-batch setup verification |
| npm.cmd run check:api | 37 source/maintenance modules passed syntax checks; both changed browser scripts also parsed |
| npm.cmd run build | Passed; Vite/esbuild used the previously required approved sandbox exception |
| npm.cmd run test:production | 1/1 actual production-server startup passed |
| test:browser, test:browser:quotation, test:browser:rfq | All passed in real Chrome with disposable database fixtures; existing quote/recovery/history behavior preserved; manual suite additionally checks missing-key fallback |
| npm.cmd run test:browser:ai | Passed: real Chrome + PostgreSQL with explicitly mocked Gemini; consent, multiple parts, all four verification labels, source display, normalization, correction/completion, manual keys, confirmed register save, quota/manual fallback and 390px no-overflow |
| npm.cmd run test:ai:live | LIVE PROVIDER TEST NOT RUN: AI_API_KEY is not configured |

No application test failures remain; expected denial/provider-error scenarios passed their assertions. Initial sandbox npm registry lookups failed EACCES; approved registry access/install succeeded, with zero reported npm audit vulnerabilities at installation. Desktop/mobile review screenshots under ignored .tmp were visually inspected; a wrapping status badge was corrected and build/AI browser test rerun. No visual artifacts or generated dependencies are committed.

Unit coverage also exercises the real SDK serializer through mocked fetch (not Gemini), missing/invalid config, malformed/schema-invalid/truncated responses, exact/absent/wrong-part evidence, ambiguous units/counts, contradiction markers, missing/omitted fields, one transient retry and a provider ignoring abort. HTTP tests exercise auth/consent/Origin/CSRF, redacted failures/logs, total timeout, disconnect, concurrency/actor limits and the unchanged confirmed save/replay service. Chrome saves human-corrected values and verifies database facts directly.

## Exact changed files

- .env.example
- README.md
- apps/api/package.json
- apps/api/scripts/test-ai-live.js
- apps/api/src/ai/evidence.js
- apps/api/src/ai/gemini.js
- apps/api/src/ai/routes.js
- apps/api/src/ai/schema.js
- apps/api/src/app.js
- apps/api/src/auth/index.js
- apps/api/src/errors.js
- apps/api/test/ai-api.test.js
- apps/api/test/ai-extraction.test.js
- apps/api/test/fixtures/synthetic-rfq.js
- apps/web/src/RfqCreate.jsx
- apps/web/src/RfqExtraction.jsx
- apps/web/src/styles.css
- docs/current-status.md
- docs/decisions/0009-gemini-extraction.md
- docs/learning-log.md
- docs/requirements.md
- docs/t02-2-handoff.md
- package-lock.json
- package.json
- tasks/T02-ai-rfq-intake.md
- tests/browser-ai.smoke.js
- tests/browser-rfq.smoke.js

## Known limits and stop

Real provider connectivity/quality remains unverified; no key/quotas guaranteed. Verification deliberately accepts labeled facts/explicit part sections and a small unit/date vocabulary; arbitrary prose may remain unsupported. General semantic contradiction/injection detection is incomplete. Source text/evidence are not a durable audit artifact in this slice. Large responses can hit the bounded output/deadline; manual fallback remains available. Material/machine/rate choices and manufacturing gaps require the estimator. Existing HTTP quotation costing still supports one part; multi-part register/read/internal costing unchanged. Existing ownership, two-role global read scope, one-operation routing and tab-storage limits persist.

No changes to migrations 001-005, grants, approved finance/spec/goldens, quotation history, authentication policy or T02.1 save transaction. No development/public database migration/reset, deployment, Excel/PDF intake, approvals, rate editor or paid-service activation. STOP before T02.3 pending owner review.

## Owner understanding questions

1. Why does a verbatim quote alone fail to prove the value, unit or correct part, and what additional server checks are required?
2. Why can only verified normalized proposals populate fields while rate keys, missing manufacturing facts and final confirmation stay manual?
3. Why do passing mocked provider/SDK/browser tests not prove Gemini access, and how do extraction retries differ from T02.1 save idempotency?

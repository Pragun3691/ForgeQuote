# T02 Gemini part association correction - 2026-11-03

Branch: feature/T02-ai-rfq-intake. Owner approved the isolated bug fix from clean f08264cc04b3d462cf240af9722831fa40eabaf6 after T02.3 was committed. No Excel or additional milestone work is included.

## Root cause and corrected data flow

The exact supplied SP-101/BR-202 numbered source block is apps/api/test/fixtures/numbered-rfq.js: numberedSource. A separate numberedBrowserSource adds only synthetic RFQ reference/customer/date for the full browser save workflow.

Diagnosis with the real SDK returned two model proposals anchored Part 1:/Part 2:. The old source detector recognized only Part Number lines; their anchors did not match the numbered proposals. Reconciliation retained the two unsupported proposals and appended two missing source placeholders, yielding four components. React mapped every response component to a form part, with unsupported fields empty. Conversion itself worked when the same proposals used exact Part Number anchors.

Now sourceSections recognizes explicit Part N: headings (positive one-to-three-digit integer), legacy Part:/Item: headings and standalone Part number: sections. Part Number lines inside explicit sections are metadata, not boundaries. Each section starts at its heading and ends before the next heading, preventing the next numbered heading from leaking into the previous evidence scope. Mixed or malformed layouts that cannot be established by this grammar remain manual; there is no general document interpreter.

Exact unique heading or part-number-line aliases may associate a model proposal. An unrecognized anchor may associate only when the complete claimed part-number value and its unique verbatim quote independently pass the existing part-number field verifier in exactly one bounded section. This supports an imperfect model anchor without fuzzy text/identifier matching. A recognized heading that contradicts supplied identifier evidence blocks all fields for that proposal's source component.

Reconciliation builds one review component for each source section, in source order, rather than iterating model components then appending placeholders. Each missing proposal leaves that component's fields missing. An unmatched proposal becomes a visible warning with its proposal index, anchor and supplied identifier, requiring manual source review; it never makes another editable row. No unknown source association is silently accepted. Duplicate source identifiers, duplicate numbered headings, conflicting/repeated identifier metadata or multiple model proposals targeting one component make the affected fields ambiguous with no normalized values and explicit warnings. There is no merge, first-wins/last-wins rule or hidden deduplication.

The unchanged per-field verifier still requires exact quotes and complete labeled raw values inside the matched section, unique evidence locations there, supported units and exact numeric normalization. Cross-part evidence remains unsupported. Repeated identical values may independently verify in separate bounded sections because each has its own quote offsets; repeated evidence inside one section remains rejected by the existing uniqueness rule. A unique numbered heading may bound other facts when its identifier is missing; the part-number field stays missing/unsupported for manual entry, never inferred from the section ordinal.

The prompt now describes this same one-component-per-heading contract. Provider JSON/Zod schemas, model, arithmetic, input/security/deadline/retry rules and rate keys are unchanged. React's existing warning renderer and verified-only form mapping work with the canonical two-component response; only explanatory UI copy changed. Missing cycle/setup values remain blank, all internal keys remain unselected, and estimator confirmation plus the existing atomic/idempotent save are required.

## Test evidence

- Tests first: eight new association tests; seven failed before the fix and the legacy case passed. After the correction the focused association/extraction run passed 25/25.
- npm.cmd test: 78/78 passed, including all nine unchanged external financial goldens, existing schema/quote/token/unit tests and Excel parser coverage.
- npm.cmd run test:db: 81/81 reported results passed. New numbered HTTP fixture deliberately includes an unmatched third proposal, proving two verified source components, a visible warning, correct weights and no extraction writes. Existing authentication/CSRF/security/permission, immutable history, confirmed save and replay tests passed in disposable schemas/databases.
- npm.cmd run test:ai:live: actual baseline fixture passed; exact numberedSource also passed with exactly two ordered verified SP-101/BR-202 proposals after server verification, correct descriptions/materials/annual quantities, 0.61/1.25 kg and missing cycle/setup. Uses real SDK, existing private key, unchanged gemini-3.5-flash-lite and current checked-in code; no diagnostic schema/adapter override.
- npm.cmd run test:browser:ai:association: real Chrome + disposable PostgreSQL with mocked model response (reversed proposals and an unmatched extra). Exactly two review regions and two populated manual form groups, correct identifiers/description/weights/quantities, visible unmatched warning, missing manufacturing/keys, deliberate completion and confirmation, exactly two saved parts.
- npm.cmd run test:browser:ai:live: same browser/API workflow with REAL Gemini, not a replay/mock. Passed two review regions -> two populated form parts; checked all exact normalized facts, empty cycle/setup and six key selections per part before human completion, unchecked confirmation/disabled save, then explicit completion/confirmed save and two persisted rows. This live browser fixture adds synthetic RFQ header fields to the exact part block.
- Existing test:browser:ai, test:browser:xlsx, test:browser:rfq, test:browser:quotation and test:browser all passed. Manual RFQ initially failed its existing immediate field-enabled assertion at tests/browser-rfq.smoke.js:27 while a live browser run overlapped; isolated rerun passed without edits. No test or implementation was changed to hide that timing-sensitive failure. The other suites did not fail.
- npm.cmd run build passed with normal filesystem access required by Vite. npm.cmd run check:api passed 40 modules; node --check passed the new fixture/unit/browser scripts. Actual production startup test passed 1/1.
- Screenshots .tmp/ai-numbered-{live,mock}-{desktop,mobile}.png were produced; real-provider desktop evidence view was visually inspected. Assertions verify populated form values after the deliberate apply action. No source/credentials/full raw provider responses were logged; normal tests mock providers and explicit live commands require configuration/consent.

No new package/dependency, endpoint or migration. Fixtures use synthetic data and disposable PostgreSQL; no existing development database/ownership/grant reset. No modification to approved finance/golden expectations, rate history, quotation persistence, existing Excel implementation, provider schema or Gemini model. No deployment/push.

## Remaining limits and stop

The demonstrated manual-QA issue is resolved for the supplied source and documented heading grammar, not a claim of general semantic extraction accuracy. Unsupported layouts, ambiguous/conflicting identifiers, provider omissions/duplicates and quota/network failures remain visible and require manual handling. An unmatched proposal is retained as a summary warning, not automatically applied. The existing manual RFQ browser assertion can be timing-sensitive. Sources/evidence remain transient; only confirmed RFQ business fields persist. Existing one-part quotation HTTP/UI scope, pending RFQ PDF intake, final quotation PDF/approval/rate-editor/deployment work are unchanged. STOP before further features.

Owner understanding checks:
1. Why must source sections own review/form cardinality instead of model proposals?
2. What exact evidence permits identifier-based fallback, and why does it not authorize cross-part field evidence?
3. Why do duplicate/conflicting identifiers or proposals block mapping rather than being silently merged?

## Exact changed files

- apps/api/package.json
- apps/api/scripts/test-ai-live.js
- apps/api/src/ai/evidence.js
- apps/api/src/ai/gemini.js
- apps/api/test/ai-api.test.js
- apps/api/test/ai-association.test.js
- apps/api/test/ai-extraction.test.js
- apps/api/test/fixtures/numbered-rfq.js
- apps/web/src/RfqExtraction.jsx
- docs/current-status.md
- docs/decisions/0009-gemini-extraction.md
- docs/learning-log.md
- docs/requirements.md
- docs/t02-2-handoff.md
- docs/t02-3-handoff.md
- docs/t02-part-association-handoff.md
- package.json
- tasks/T02-ai-rfq-intake.md
- tests/browser-ai-association.smoke.js

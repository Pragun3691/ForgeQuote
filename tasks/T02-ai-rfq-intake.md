# T02 - RFQ intake (owner approval, 2026-11-03)

Branch: feature/T02-ai-rfq-intake from latest local main at 099131f. Replaces earlier T02 rate-history numbering; T01 implements history/snapshot foundations.

## T02.1 - Manual creation (authorized stop point)

- Active estimator creates 1-20 reviewed parts with validated business fields/decimal strings.
- Select real categorized rate keys; no invented values.
- Atomic header/parts/initial routes/actor-key receipt; same-key replay, changed-content conflict.
- Persisted register/detail and clear validation/error/recovery states.
- Migration 005/minimum column grants; preserve 001-004 and nine goldens.
- Real PostgreSQL disposable fixtures, Chrome workflow, focused commit/handoff and STOP.

Implemented/tested; see docs/t02-1-handoff.md. Existing one-part quotation HTTP/UI limit preserved. No deployment/purchase.

## T02.2 - owner authorized 2026-11-03; implemented, live synthetic verification passed

Official @google/genai 2.32.0, initial configurable gemini-3.5-flash-lite, pasted-text source with explicit synthetic attestation/consent, strict structured output and literal value/part/token/unit verification. Review/correction/manual keys and final confirmation use unchanged T02.1 save contract. Explicit provider/configuration/validation failures and manual fallback. Bounded input/output/deadline and one transient retry; no source/key logging.

Mock-provider unit/HTTP/SDK-transport and real PostgreSQL/Chrome workflows passed; genuine-test command reported LIVE PROVIDER TEST NOT RUN (no AI_API_KEY). That original missing-key result is superseded by the owner-approved live correction below. Provider terms/rules: ADR-0009. Full evidence/manifest/setup: docs/t02-2-handoff.md.

## T02.2 live correction - owner approved 2026-11-03

Starting HEAD 7f8a58f. Provider schema omits only parts.maxItems; Zod max(20), evidence/numeric/association/security checks and model remain unchanged. Request/schema, model/resource, access, quota, billing and precondition errors now have separate controlled classifications. Regression tests cover exact provider schema and server rejection of 21 parts. Checked-in npm.cmd run test:ai:live passed with the existing key, real synthetic multi-part response and complete server validation. Unit/config/costing 63/63 and PostgreSQL 75/75 passed with all nine unchanged goldens. See docs/t02-2-handoff.md for final browser results and manifest. No deployment/billing/schema/financial changes.

## T02.3 - owner approved Excel first, 2026-11-03; implemented

Clean starting HEAD fad3d79. Deterministic bounded .xlsx template, exact string inputs, shared strings/sparse row/cell references, worksheet/cell evidence, explicit whole-import rejection and human correction/confirmation through unchanged RFQ save/idempotency. No Gemini call for Excel. Disposable security/API/Chrome fixtures and unchanged financial goldens. Final checks: 70 unit/config/costing; 80 reported PostgreSQL; all five Chrome suites; 40 syntax modules; production build/startup and audit passed. Contract/manifest/limits: docs/t02-3-handoff.md; ADR-0010.

PDF assessment only: Node engine compatible, actual canvas-free runtime unverified, no package installed or PDF code. Recommend defer pending separate approval. Quotation PDF generation remains a separate future requirement.

Recovery verification after shutdown reran all listed suites. The only unfinished code fix was a test-only absolute URL for example download; application code survived intact. Separate owner-reported Gemini manual QA (SP-101/BR-202 yielded four unsupported suggestions) remains unresolved and outside this Excel correction. See handoff recovery section.

## Separate T02 Gemini association correction - owner approved 2026-11-03; verified

From f08264cc04b3d462cf240af9722831fa40eabaf6, recognize numbered boundaries/identifier metadata and reconcile one source-ordered component per section. Unknown proposals warn; duplicate/conflicting associations never merge/verify. Exact evidence/numeric rules, model/provider schema, Excel and save service unchanged. Exact manual-QA block, adversarial/legacy/API tests, checked-in real Gemini fixtures and real Chrome provider workflow passed. 78 unit/config/costing, 81 reported PostgreSQL, six standard Chrome suites plus real-provider Chrome, build/startup/syntax passed (existing manual RFQ timing assertion required isolated rerun). Full handoff: docs/t02-part-association-handoff.md; ADR-0009. The prior recovery note's unresolved finding is now superseded by this correction.

## After association correction - STOP pending review

Excel is complete for its narrow template. Do not start text-PDF support or other features until owner review. No approval, quotation PDF, rate-master editor, deployment, billing activation or service purchase. Never commit/expose credentials.

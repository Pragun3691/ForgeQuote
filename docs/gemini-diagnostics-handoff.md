# Gemini diagnostics handoff - 2026-11-06

Implemented the owner's focused authorization from main a2770dc on feature/gemini-diagnostics. Local completion only; no push, merge or deployment.

## Changed files and behavior

- apps/api/src/ai/diagnostics.js: predefined identifier allowlists, safe provider facts/category selection and explicit event projection.
- apps/api/src/ai/gemini.js: one terminal event per started attempt, immediate abort events with late-settlement deduplication, documented API_KEY_INVALID access classification, controlled pre-abort/ retry-abort errors.
- apps/api/src/request-logging.js: production-only attempt sink, re-projected fields and existing server-generated request ID; isolated sink exceptions.
- apps/api/src/ai/routes.js: pass that request's logging callback to extraction.
- apps/api/test/ai-extraction.test.js: category/redaction/retry/deadline/cancellation/SDK parsing/sink-failure tests.
- apps/api/test/ai-api.test.js: real HTTP request-ID correlation, invalid-key/transport/internal modes, client-disconnection events and existing secret-exclusion assertions.
- docs/current-status.md, docs/learning-log.md, docs/decisions/0009-gemini-extraction.md, tasks/gemini-diagnostics.md and this handoff: results, contract and limits.

Endpoints remain GET/POST /api/rfq-extraction. No new endpoint, dependency or migration. Public messages remain fixed. HTTP 400 API_KEY_INVALID now returns existing HTTP 503 AI_PROVIDER_ACCESS. The existing cancellation contract is enforced for already-aborted requests. Model, prompt, evidence/schema verification, financial code, two total attempts, 250-ms retry delay and 20-second default are unchanged.

## Validation

- npm.cmd test: 90/90, including 25 focused Gemini tests, all nine financial goldens, production log security, TLS and existing extraction evidence/association checks.
- node .tmp/t06-run.mjs --test apps/api/test/ai-api.test.js apps/api/test/auth.test.js: 24/24, including suite parents. Existing local-only wrapper created a random disposable parent database; fixtures and parent were removed in finally blocks. No existing development/test data was migrated/reset.
- npm.cmd run check:api: 47 source/maintenance module syntax checks.
- npm.cmd run build: passed; first sandbox attempt failed esbuild ancestor-directory access, normal-access rerun passed.
- npm.cmd run test:production: 1/1 actual production server startup, React/assets, liveness and honest failed readiness with unavailable fixture DB.
- git diff --check: passed before commit.

Provider responses were injected or SDK transport mocked. No real Gemini or cloud request was made; existing successful extraction behavior is verified offline and through real local HTTP/PostgreSQL, not claimed live.

## Sanitized illustrative events

These are examples of the exact event shape, not production observations. Success has null upstreamStatus because the SDK's parsed generation response does not expose an HTTP success status.

```json
{"event":"ai_provider_attempt","attempt":1,"durationMs":4012,"upstreamStatus":503,"category":"PROVIDER_HTTP","providerReason":"OTHER","providerStatus":"UNAVAILABLE","transportCode":"OTHER","deadlineExpired":false,"cancelled":false,"requestId":"00000000-0000-4000-8000-000000000001"}
{"event":"ai_provider_attempt","attempt":2,"durationMs":15738,"upstreamStatus":null,"category":"APPLICATION_DEADLINE","providerReason":"OTHER","providerStatus":"OTHER","transportCode":"OTHER","deadlineExpired":true,"cancelled":true,"requestId":"00000000-0000-4000-8000-000000000001"}
{"event":"ai_provider_attempt","attempt":1,"durationMs":35,"upstreamStatus":400,"category":"PROVIDER_HTTP","providerReason":"API_KEY_INVALID","providerStatus":"INVALID_ARGUMENT","transportCode":"OTHER","deadlineExpired":false,"cancelled":false,"requestId":"00000000-0000-4000-8000-000000000002"}
```

## Limits and safe next verification

No Neon/Render, persistent environment, migration, deployment, push or merge changes. Existing production root cause remains unknown. TypeError in generate is the existing transport heuristic; transportCode OTHER does not identify DNS/TLS/socket failure. Aborting local work cannot guarantee cancellation at Google. Synchronous response validation cannot be preempted by a JavaScript timer. If a deadline occurs during the retry delay, there is no active attempt to log: use the final HTTP AI_TIMEOUT plus the preceding attempt event. A disconnected response may not have an HTTP finish log.

After separately approved deployment, use the existing synthetic-rfq.js fixture through the deployed estimator UI with explicit synthetic/consent checks. Run sequentially within five attempts per estimator per 15 minutes. Record only request IDs, duration, safe categories and expected field/count assertions; verify two components, spindle weight 0.61 kg and cycle 3.2 min, with exact evidence and absent fields remaining missing. Do not save an RFQ for this check. Correlate a failure with attempt events and the same project's Google usage/quota view. Do not print credentials, HTTP/SDK objects, browser cookies, source or raw provider errors. A passing run proves that fixture/time only; do not enable billing or change model/timeout as an implicit fallback.

## Owner understanding questions

1. How does upstreamStatus 504 differ from category APPLICATION_DEADLINE?
2. Why can two attempt events share one HTTP request ID and one 20-second deadline?
3. What can transportCode OTHER establish, and why must raw error text stay out of logs?

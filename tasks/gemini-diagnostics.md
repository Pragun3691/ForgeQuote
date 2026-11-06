# Gemini production diagnostics

Owner-approved scope, 2026-11-06. Base main a2770dc; branch feature/gemini-diagnostics. Complete locally; commit and STOP without push/merge/deployment.

- Add allowlisted request-correlated provider-attempt events and distinguish HTTP, transport, deadline, client cancellation and internal failures.
- Recognize documented API_KEY_INVALID; preserve controlled public messages, successful extraction, retry limits and 20-second default.
- Test redaction, unknown identifiers, retries, deadline/cancellation including unresponsive SDK, HTTP correlation and security boundaries.
- No Neon, migrations, Render, configured environment changes, financial changes, prompt/evidence changes or unrelated refactoring.

Completed verification: 25 focused Gemini tests within 90 unit/config/parser/PDF tests; 24 disposable PostgreSQL AI API/auth tests; 47 API module syntax checks; production build and actual production startup 1/1. Initial pre-abort regression exposed an existing raw AbortError race and now passes with controlled AI_CANCELLED. Sandbox build access denial resolved by normal-access build. No live provider test. Handoff: docs/gemini-diagnostics-handoff.md; decision extension: ADR-0009.

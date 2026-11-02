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

## T02.2 and later - direction, not permission to start

Real Gemini official SDK; initial configurable gemini-3.5-flash-lite; structured extraction, literal source-evidence checks, human correction/review, deterministic Excel import, optional practical text-PDF intake. Explicit failures/manual fallback. Free integration restricted to synthetic/nonconfidential demo documents. Provider terms ADR and real integration verification required; never commit/expose API keys. No approval, quotation PDF or rate-master editor in T02. Wait for owner approval before Gemini extraction.

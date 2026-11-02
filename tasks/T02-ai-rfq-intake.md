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

## T02.2 - owner authorized 2026-11-03; implemented, live verification pending

Official @google/genai 2.32.0, initial configurable gemini-3.5-flash-lite, pasted-text source with explicit synthetic attestation/consent, strict structured output and literal value/part/token/unit verification. Review/correction/manual keys and final confirmation use unchanged T02.1 save contract. Explicit provider/configuration/validation failures and manual fallback. Bounded input/output/deadline and one transient retry; no source/key logging.

Mock-provider unit/HTTP/SDK-transport and real PostgreSQL/Chrome workflows passed; genuine-test command reported LIVE PROVIDER TEST NOT RUN (no AI_API_KEY). No AI connectivity/completion claim. Provider terms/rules: ADR-0009. Full evidence/manifest/setup: docs/t02-2-handoff.md.

## T02.3 and later - STOP pending review

Do not start deterministic Excel import, optional text-PDF support or other features until owner review. No approval, quotation PDF, rate-master editor, deployment, billing activation or service purchase. Never commit/expose credentials.

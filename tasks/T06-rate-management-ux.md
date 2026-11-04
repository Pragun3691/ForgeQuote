# T06 - Rate catalogue and essential intake UX

Owner approved implementation, disposable local tests, documentation and commit without another planning approval, 2026-11-05. Clean main and fetched origin/main both at 1f4f038; branch feature/T06-rate-management-ux. Owner reports T01-T05 merged/deployed and the live approval -> issuance -> customer PDF workflow manually passed; no cloud verification was performed in T06.

## Implementation plan and permitted slice

Read the existing rates schema, ADR-0003 effective-start policy, runtime grants and two-role authorization contract. Add an authenticated rate catalogue/history endpoint and UI, then compact RFQ/extraction summaries, collapsible evidence, missing-field indicators, component navigation, explicit single-key suggestions and common-key copying. Keep costing, snapshot/lifecycle/PDF services, extraction verification and exact save/retry bodies unchanged.

Data flow: active server actor -> SELECT-only catalogue -> exact numeric strings + derived effective periods -> rate-history UI / intake suggestion candidates. Estimator explicitly chooses or applies real key IDs -> existing manual form -> final human confirmation -> unchanged validated/idempotent RFQ POST. No Gemini input chooses an authoritative financial key or price.

Security finding: rate_keys/rate_versions/rate_periods are SELECT-only for runtime. No accepted policy designates either demo role a financial master writer. Per the owner's conditional scope, implement read-only management and explicitly deny rate writes; do not create an elevated writer policy, privileged function, maintenance connection or runtime INSERT grant. New version creation remains a decision for a separately authorized validated maintenance workflow.

## Assumptions, tests, risks and deployment

Both active demo roles may view rates. Default as-of date is Asia/Kolkata today; explicit valid date supported. A missing applicable rate remains visible and never becomes zero. A sole candidate means exactly one key with a stored applicable version on the displayed date, not an AI material match. Suggestions stay unselected until the estimator acts and still require final review. Manual RFQ key selection can reference a key that lacks today's rate, with an explicit warning: existing costing resolves its actual pricing date later.

Tests: catalogue categories/values/units/version IDs/timestamps; start and next-start boundaries; no-history keys; backend/SQL denials; immutable quote after backdated append in a disposable fixture; human key confirmation, common copying and reset; real multipart persistence; collapsed Gemini/Excel evidence; keyboard/mobile form navigation; all existing unit/costing/PostgreSQL/Chrome/syntax/build/startup suites and nine goldens.

No schema, grants, dependency, formula, financial persistence, AI provider, Neon/Render, deployment, push or merge change. Risks/limits: two-role demo read scope and no pagination; source author/supplier is not stored; write role/precision/audit/retry rules for maintenance remain undecided. Optional exact material aliases omitted because no approved alias registry exists. Rate history links during editing open a new tab to retain unsaved fields. Handoff: docs/t06-handoff.md; ADR-0016. STOP after T06 commit.

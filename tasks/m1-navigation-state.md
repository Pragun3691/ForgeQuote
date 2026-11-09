# M1 - navigation, draft protection and state reliability

Owner approved M1 from `docs/ux-frontend-audit-2026-11-09.md` on November 9, 2026. Continue existing `feature/forgequote-visual-v2` at `a9fb910`; preserve all earlier uncommitted design/audit work. No additional planning gate is needed for this explicitly approved milestone. No M2, commit, push, merge or deployment.

Scope: preserve unsent costing/intake/authoring data through internal navigation, correct current-hash RFQs and history/active navigation, clear obsolete read errors, make manual fallback feedback visible/focused, and refresh dependencies without resetting drafts or accepting late reads. Preserve all submitted intent, financial and authorization contracts. No new dependency, backend, API/schema or security-policy change.

Implementation plan: shared hash parser; auth-scoped transient working-input store; retain the one intake/rates component tree while inactive; resource-specific read errors and abort/sequence guards; parent fallback notices; narrow dependent refresh callbacks. No new browser-storage persistence. Tests first for the confirmed failures, followed by complete existing browser coverage, unit/financial/build/startup and keyboard/responsive checks. ADR-0021 records the lifetime/recovery distinction.

Existing frontend/browser files were copied into ignored `.tmp/m1-before/` before edits. The M1 handoff and exact rollback instructions are in `docs/m1-handoff.md`. Stop after M1 for owner review.

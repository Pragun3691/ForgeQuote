# M2 - design system consolidation and application shell

Owner approved the file-level implementation plan on November 9, 2026, then authorized implementation on the existing `feature/forgequote-visual-v2` branch. M1 was accepted. No M3, commit, push, merge or deployment.

Before edits, `.tmp/m2-before/` captured all 216 tracked/nonignored files, their SHA-256 hashes, exact HEAD/branch/status and binary staged/unstaged patches. Existing work was not reset, cleaned, stashed, staged or discarded. The checkpoint includes accepted M1 and earlier visual work.

Scope: one token/control system; remove obsolete CSS overrides; extract stateless branding/login and a stable shell; improve readable typography, login composition, sidebar/mobile navigation, skip navigation, task titles/focus, contrast, reduced motion and reflow. Small ActionButton/Field/Notice helpers own presentation only. Auth handlers, API/recovery/draft/financial state owners remain intact. Rate authoring receives a distinct presentation class.

Verification: existing 13 browser suites plus M1/M2, focused state/display/evidence units, existing unit and financial golden gates, production build/startup. Actual before/after Chrome screenshots at 1440x1000, 768x1024, 390x844 and 320x844; supplementary breakpoint and native Chrome 200%/400% zoom checks. Downstream costing, matrix, Gemini evidence, authoring and issuance must be reviewed. Use only existing isolated local test fixtures. No live provider, development DB mutation or credentials exposure.

Final results, exact changed files, screenshot links, limitations and M2-only rollback: `docs/m2-handoff.md`. Architectural decision: ADR-0022. Stop for owner review after M2.

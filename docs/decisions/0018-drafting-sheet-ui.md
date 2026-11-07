# ADR-0018 - Drafting Sheet Soft Dark presentation

Status: direction and implementation scope accepted under the owner's Tier 1 authorization, November 7-8, 2026. Visual implementation approval remains pending owner review. Branch: feature/forgequote-ui-redesign. Supersedes the light/teal visual direction in docs/ui-ux-direction.md only.

Subsequent owner decision: the Tier 1 visual refinement was reviewed and accepted before Tier 2 planning. The separately approved Tier 2 implementation is recorded in ADR-0019; its final visuals still require owner review. Earlier pending-review statements in the first-pass handoffs are historical checkpoints.

Use the approved dark canvas/panel/raised palette, neutral typography, 4px corners, restrained rules, compact tables and tabular numerals. Copper is for available next actions; settled and error colors accompany written status labels. Primary/secondary/tertiary text must pass 4.5:1 against all three surfaces. Input boundaries use tertiary rather than the low-contrast structural hairline. Preserve the visible 3px focus outline.

The shared shell links existing RFQs, the Sales Head pending-approvals section and rate catalogue. It shows identity, actual role, sign-out and synthetic-demo notices. Opening rates during active intake uses a new tab to preserve the original form. No new page, permission or API contract is introduced. Register status remains RFQ outcome; its existing response does not contain quotation lifecycle state, so no lifecycle badge is invented or inferred from RFQ outcome.

The selected immutable snapshot supplies the prominent combined annual baseline. The existing lifecycle component is relocated alongside that summary; its state, event reads, decisions, recovery and PDF operations remain authoritative and unchanged. A version must still be selected through the existing version navigation or saved/recovered request before a saved value can appear. No automatic calculation or change to version selection is added.

Decimal grouping splits strings and inserts separators without Number conversion, rounding or trimming stored precision. Date-only values are interpreted at midnight in Asia/Kolkata, while timestamps explicitly use that zone and an IST label. Date inputs retain ISO values. Full IDs are available through keyboard-operable inline disclosure buttons and selectable text; they are not regenerated, renumbered or changed in requests/download names.

IBM Plex is preferred when installed, with Segoe UI/system sans and platform monospace fallbacks. No remote font request or new package is introduced. Local Chrome screenshots verify readable rupee glyphs in the tested fallback. Font appearance can differ across operating systems.

No backend, migration, dependency, calculation, financial assumption, rate resolution, extraction, auth, saved-request semantics or PDF service change. The owner explicitly prohibits committing, pushing, merging or deploying until review. Tests use synthetic disposable local PostgreSQL fixtures, not the existing application database or cloud.

## Owner-requested visual refinement - November 8

Replace desktop top navigation with a 208px fixed sidebar and use compact horizontal navigation at widths up to 900px. Identity, role and synthetic notice stay available. Remove redundant register/catalogue links; retain the detail breadcrumb and intentional new-tab history link during intake. Existing links/role checks and intake preservation remain authoritative.

Register columns separate reference/customer/due/estimator/RFQ status. Pending approvals use a semantic table with RFQ/customer, version, saved annual value and review link from the existing pending response. No dates, metrics or quotation states are synthesized.

RFQ status/assignment live once in the title block. The outcome component retains terminal decisions, recovery, errors and history but renders no empty status panel. Its refresh action sits beside the title block; the same saved baseline appears once. Part facts and the original costing form share a desktop workbench; version navigation precedes the saved summary. Calculation/submission state is not rebuilt.

The rate catalogue is one compact table with native expandable history. A separate string-only rateLabel helper removes trailing fractional zeros for display without rounding, coercion or mutation. Monetary values keep their paise. Exact stored rate strings remain visible in expanded history, alongside effective boundaries, IDs, recorded timestamps and actor/reason. The authoring form keeps its original state/validation and moves below the catalogue.

Shared ScrollTable measures actual overflow with ResizeObserver, displays direction cues only when needed, exposes a labelled keyboard-focusable scroll region, and updates its edge cues when scrolled. Mobile register references stay visible in a sticky first column. Rates place the key and applicable value first so both are visible at 390px. No gradient, chart, graphic or new dependency is introduced.

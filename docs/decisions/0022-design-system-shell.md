# ADR-0022 - consolidated design system and stable application shell

Owner approved M2 after accepting M1 on November 9, 2026. This refines ADR-0020's charcoal/forest/ivory/crimson identity. It does not replace it or change ADR-0021's state, route or recovery contracts.

## Presentation boundaries

`main.jsx` retains session bootstrap, controlled credentials, login/logout and expiry. Those three asynchronous handlers remain byte-identical to the pre-M2 checkpoint. `LoginView` accepts values and callbacks; `Brand` owns the original SVGs. `AppShell` accepts the existing parsed route and renders the same keyed Workspace child in a stable content position. No wrapper is keyed by route and no workflow state is moved. The shell's own title/focus/measurement effects do not load data or write submissions.

`ui.jsx` provides only native ActionButton, Field and Notice presentation. Feature controls continue to use native semantics and shared CSS variants; there is no component framework, new form engine, generic request hook or global store. Existing accessible names, consent text, exact financial strings and browser selectors are preserved. Rate authoring's `rate-author` class stops lifecycle layout rules leaking into it.

## One style system

The stylesheet entry imports tokens, base controls, retained workflow layouts, shell and login. The old accumulated override layers are removed. Repeated selector/context declarations are consolidated; responsive rules are grouped by owning feature and ordered from wider to narrower. Structural layout exceptions remain explicit rather than forcing different workflows into one generic component.

Colors live in tokens, including hover/selected/error/pending/evidence treatments. Charcoal is the canvas, forest is structural, ivory is readable content/primary action and crimson remains branding. Structural borders are separate from accessible control boundaries. Typography uses the existing local system font at a user-relative root; essential text is at least 12px at default settings, with shared 13px labels/tables and 15px body text. Spacing uses the approved 4/8/12/16/20/24/32/40px rhythm. Shared radii, control heights, focus and short transitions have one source. No remote font, dependency, image service or external asset.

Button fill and text change atomically across disabled/busy states. Rendered tests caught a low-contrast intermediate color when both were interpolated; border-only button transitions retain feedback without that intermediate state. Request-driven animation-frame contrast checks cover this boundary alongside steady-state samples.

## Navigation and focus

The first keyboard destination is Skip to main content. Its handler prevents hash navigation and focuses the content region; it does not create a route/history entry. Anonymous login also has a skip destination. Navigation uses the accepted route parser and preserves intake's separate-tab rates behavior and role normalization.

Task changes update the document title and focus a visible heading or the stable content region if the heading is not yet available. Initial authenticated mount does not autofocus. The effect excludes version-only selection and background metadata/list refresh, so it cannot steal focus during those reads. Existing evidence focus/return and modal initial focus/cancellation remain the feature owners' responsibility.

Desktop has a fixed, independently scrollable sidebar. At 1050px and below, navigation becomes a compact wrapping header. Readable identity text replaces duplicated account chrome; the existing full signed-in heading remains its accessible name. A ResizeObserver publishes actual sticky-header height through one inherited CSS offset. Controls and source/section targets use that offset. On short viewports, including high zoom, the header scrolls normally instead of consuming most of the usable height.

## Verification and limits

Subsequent owner-approved branding cleanup on `feature/forgequote-branding`: keep ForgeQuote as the product name; replace the visible Demo identity label with Account while preserving its control ID/name and both existing role values. One login paragraph explains shared accounts, common synthetic-record access and nonconfidential-only use. Retain the brief authenticated data reminder and every Gemini-specific warning/consent. Remove the duplicate badge and genuinely obsolete CSS; do not rename records, PDFs, environment variables or service URLs as part of presentation cleanup. Browser tests update the intentional accessible-name change and strengthen branding/disclosure checks without removing existing assertions. See `../branding-handoff.md`.

Browser checks include native Chrome host page zoom at 200% and 400% in fresh task-owned profiles, not CSS zoom or pinch emulation. CDP captures the native zoom viewport directly, avoiding Playwright's CSS-pixel clipping at browser zoom. Standard requested-size screenshots remain exact Playwright viewport captures. Reflow, keyboard/focus, computed text colors and existing contrast/reduced-motion/modal/evidence tests are required alongside full M1 and financial regressions.

Chrome checks are evidence for the tested states, not a complete accessibility certification or Safari/Firefox/physical-device claim. Ordinary draft lifetime remains M1's memory-only authenticated-tab contract. Business workflow restructuring belongs to later milestones. No endpoint, migration, tenant model, financial formula, API contract, authentication policy or deployment changes.

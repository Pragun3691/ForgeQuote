# ADR-0020 - Charcoal, forest and ivory frontend

Status: owner authorized the complete frontend redesign on November 8, 2026; visual acceptance is pending owner review. Work remains uncommitted on `feature/forgequote-visual-v2`, based exactly on `a9fb910`.

This supersedes ADR-0018's Drafting Sheet palette and the copper references in ADR-0019. All behavioral contracts in those decisions remain in force, including source evidence verification, saved-version consistency, intake preservation and issuance confirmation.

Use charcoal `#171717` for the application canvas, forest `#06110C` for navigation, selected structural surfaces and saved-baseline context, ivory `#FAF8F3` for text and primary actions, and crimson `#A31C1B` for the original ForgeQuote mark. Secondary/tertiary text, neutral surfaces, control boundaries, focus and semantic feedback have explicit supporting tokens in `styles.css`. Crimson is not a status or default action color. Error, success and pending colors accompany existing written labels.

Retain platform Segoe UI/system fonts, compact semantic tables, native selects, details and modal dialog. No dependency, remote font, image service or external asset is introduced. The folded-tool mark, navigation line icons and manufacturing line drawing are original inline SVGs; decorative drawings are hidden from assistive technology. Login uses an editorial split on desktop and a compact stacked composition on mobile. Motion is limited to short color/border transitions and disabled under reduced-motion preferences.

Apply the design through shared tokens and existing component classes rather than duplicating workflow state. `main.jsx` changes presentation markup and adds stateless graphics. Session bootstrap, login/logout, expiry/CSRF refresh and password clearing are unchanged. All other workflow handlers, decimal-string rendering, snapshot guards, consent and exact-key request recovery remain unchanged. The 100% scenario receives a visual column emphasis; no value or chart is calculated in the browser.

Text colors are checked against all four structural surfaces at 4.5:1 or greater. Control boundaries and focus exceed 3:1 on those surfaces; the focus indicator remains a visible 3px outline. Structural hairlines and decorative drafting guides do not serve as control boundaries. Keyboard checks cover login, workspace navigation, scrolling financial tables, evidence focus/return and modal focus trapping/cancellation. Mobile dialog order matches DOM/tab order.

Verification uses real Chrome and disposable local PostgreSQL fixtures. Gemini is substituted only in tests; no live provider call or renewed provider-terms claim is made. No backend, API, schema, migration, authorization, financial policy, PDF renderer, dependency or deployment changes. See `docs/visual-v2-handoff.md` for results, screenshots and limitations. Stop for owner review; no commit, push, merge or deploy.

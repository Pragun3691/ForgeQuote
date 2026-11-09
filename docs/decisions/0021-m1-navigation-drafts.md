# ADR-0021 - M1 navigation, transient drafts and read reliability

Status: owner approved M1 from the November 9 UX audit and explicitly authorized implementation. Local implementation awaits owner review on `feature/forgequote-visual-v2`; no commit/push/merge/deployment. ADR-0020's visual identity and all financial/security/recovery decisions remain unchanged.

## One navigation contract

`route.js` parses the existing register, rates, RFQ/version and legacy approvals hashes and adds `#view=intake`. Both the shell and workspace use this parser through React's existing useSyncExternalStore hook. New RFQ now creates a real browser history entry; RFQs exits intake, Back/Forward return to the appropriate task, and active navigation reflects the same parsed section. Rates still opens a separate tab during Estimator intake, preserving the accepted behavior; a Sales Head never inherits that new-tab behavior from an old intake hash.

No routing package or server route was added. Role-inapplicable intake/approvals hashes resolve to the register for both shell and content, so changing identities on an old URL cannot leave an invisible navigation item selected. This is presentation only; server authorization is unchanged. Unknown hash handling remains the previous register fallback; a richer not-found page belongs to a later milestone.

## Ordinary drafts and submitted intent are different

`WorkspaceDrafts` owns one transient Map and dirty set for an authenticated user/role lifetime. Costing working inputs are remembered by RFQ, including exact margin/date/routing/quantity strings. Re-entering a detail page reads fresh server metadata without reinitializing a remembered working form. A valid non-rejected submitted record always takes precedence over that ordinary cache; controls are not exposed until recovery storage has been inspected. Existing saved/uncertain body/key locking remains authoritative.

Intake is retained in a hidden subtree after first visit, preserving the one RfqCreate form, parts, review state, transient source/evidence and native selected workbook across internal navigation. The rates subtree is likewise retained. Rates reads keep previously loaded data and authoring mounted, so refresh/date changes cannot erase RateAuthor fields. Hidden content is excluded from normal rendering/accessibility navigation by the native hidden attribute; no second writable model is introduced.

Ordinary drafts are not saved to sessionStorage/localStorage, the database or a service. Signing out, session expiry and a new authenticated scope discard them. Browser beforeunload warns about unsent working data when supported; the browser controls the confirmation and may bypass it. There is no crash-recovery/autosave promise. Once an RFQ intent is durably recorded for save/replay, source/file warnings do not obstruct recovery reload; the original explicit same-key retry remains available.

This preserves the prior rule that raw source text/evidence and workbook bytes are not persisted. A source may remain transiently in the original authenticated tab's memory while its intake view is hidden, and is removed from the reachable workspace on auth unmount. Tokens/passwords never enter the draft store.

## Read reliability and dependent refreshes

Register, approval queue, catalogue, RFQ metadata, saved snapshot and lifecycle reads use abort checks; existing monotonic RFQ read tokens and selected-snapshot guards remain. RFQ unmount invalidates outstanding un-signaled metadata refreshes too. Read errors clear on their own retry/success, while unrelated errors remain. In particular, RFQ metadata success cannot clear a failed saved-snapshot read. Lifecycle storage/write/download errors remain distinct from lifecycle read failures: an ordinary GET must not erase an unresolved mutation outcome.

Read network/503 messages now identify the failed read and retry action, without instructing users to replay a nonexistent write. Domain-specific read errors retain their messages. Previously loaded rate/lifecycle data is explicitly labeled when refreshing or after a failed refresh.

Returning to register/approvals triggers fresh reads. Known successful quotation/lifecycle/outcome actions invalidate dependent reads and refresh RFQ metadata without resetting editable inputs. No mutation is automatically replayed and no financial output is recalculated by these refreshes.

## Manual fallback

Excel/Gemini cancel/fallback callbacks close their original disclosure, then publish the existing explanatory text in RfqCreate outside that disclosure. Focus moves to RFQ reference after any busy-state disabling ends. Each action creates a fresh notice event so repeated fallback works. Consent, provider terms, cancellation, apply/review semantics and transports are unchanged.

Reason textareas have stable explicit accessible names so retaining a filled textarea cannot change its name through its label's descendant text.

## Verification boundary

Seven failures were reproduced against the pre-M1 build before the fixes were verified. Additional tests cover delayed reads, auth-scope isolation and independent read errors. Existing RFQ/Excel tests change only the intake-entry step after reload, because the task now restores directly; all original key/body/duplicate assertions remain. A tracked runner includes all thirteen existing browser suites plus M1. Tests use dedicated disposable local PostgreSQL databases, never development/production data. Results, exact manifest, screenshots, limitations and rollback: `docs/m1-handoff.md`.

# ADR-0027 — Rates, decisions, documents and terminal review

Accepted under the owner's combined M7/M8 plan and implementation approval, 2026-11-09. Financial policies and backend contracts remain unchanged.

Rate catalogue filters/search use existing returned keys and hash state, not a new API or server pagination. Search replaces history; deliberate filters push. History expansion is keyed by rate key. Existing retained authoring ownership survives refresh and navigation. Controlled presentation owns only touched/validation state, not a second draft.

Rate validation mirrors the existing nonnegative plain-decimal/reason/date contract without rewriting strings or calculating money. The API's businessDate is the authoritative browser validation date; do not use the browser clock or the catalogue's historical asOf date. Effective starts must also exceed every recorded start, including future versions. Server clock/concurrency validation remains authoritative. A preview distinguishes the applicable historical value, latest start and proposed exact value/date. Explicit discard is confirmed and resets only the working draft, including validation feedback.

Approval/rejection confirmation binds the saved RFQ/version and annual ex-GST snapshot amount. Rejection reasons use the existing authenticated memory draft scope; lost reasons retain that scope and gain dirty tracking. Remembered reasons remain marked dirty while their view is unmounted; auth-lifetime teardown still ends their lifetime. Background refresh cannot silently replace drafts or steal focus. New actions require a successful current status read; pending exact-request recovery remains available. Native decision modals start on Cancel, cycle focus, support Escape and restore the initiating control. Synchronous guards prevent duplicate confirmations before React state updates.

Existing per-workflow persist-before-POST serializers, keys, paths, bodies and accepted rejection/replay rules remain. Read-only summaries render the original intent; they never reconstruct a retry from current editable fields. Known server success justifies success wording. Unknown outcomes retain the exact request and require an explicit same-key retry. No automatic POST retry is added.

PDF request state is separate from lifecycle writes. A version-keyed component owns its binary requests and aborts on unmount; late results cannot download a document after the selected context has left. Buttons keep accessible names, identify customer versus INTERNAL preparation, and show failures independently. A prepared blob justifies “browser download requested,” not a claim of disk persistence. Customer issued/current and INTERNAL saved-version eligibility, authenticated endpoints, filenames, confidentiality and both server renderers are unchanged.

RFQ sent continues to derive from actual issuance, not email delivery. Sales Head won/lost confirmation names the RFQ and terminal consequence; lost requires the existing reason contract. Cancel produces no storage or server action. Outcomes cannot be reopened. Existing issuance confirmation and snapshot binding remain separate and unchanged.

No backend/schema/API, financial formula, authentication/authorization, dependency or deployment changes. Verification, evidence limits and rollback are documented in the combined handoff.

## M8 product review refinements

Final audit correction: an unknown lifecycle response must not clear a retained dirty rejection marker. Protect nonempty Sales Head rejection drafts until confirmed non-pending/superseded state, confirmed submission or explicit clearing. Preserve immutable-version keys and existing durable same-key recovery precedence. Owner explicitly deferred the separate obsolete post-save refresh error (F2); see `../final-audit-resolution.md` for local verification and limits.

Actual source-to-outcome journeys exposed avoidable scroll hunting for lifecycle/documents/outcomes and for the multipart rate matrix. Add deliberate, focus-visible section jumps only when their real targets exist. They use the existing obstruction-aware scroll/focus system without changing the hash, selected version, draft ownership or write behavior. Move the rate preview before the save action so review precedes submission in document and keyboard order. No new workflow/API is invented.

M8 acceptance joins manual, deterministic Excel and mocked Gemini intake to real RFQ persistence, costing, Sales Head approval, issuance, both PDF types and terminal outcome. Downloads are distributed across the two legitimate roles to respect the unchanged per-actor PDF limiter. Native Chrome host zoom is captured using the browser's native frame rather than the standard screenshot clip, which produced a blank 400% artifact despite valid DOM/focus assertions. Visual review, not assertions alone, caught this evidence defect.

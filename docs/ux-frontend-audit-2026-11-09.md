# ForgeQuote - complete UI/UX and frontend architecture audit

Date: November 9, 2026, Asia/Kolkata. Status: audit complete; implementation requires owner approval.

## Executive assessment

ForgeQuote has a credible visual identity and unusually strong protection of saved financial state for a small application. Its next improvement should be a workflow redesign supported by a small, coherent component system. Another broad palette change would not resolve the main problems.

The highest priorities are preventing silent loss of ordinary unsaved edits, making navigation correspond to visible tasks, keeping read-state feedback accurate, and putting primary actions within reach on small screens. The financial engine, immutable snapshots, exact-key recovery, consent gates and server authorization should remain outside this UI work.

The current charcoal/forest/ivory/crimson direction is a suitable foundation. Retain it, improve typography and density, and consolidate its implementation instead of stacking another layer of global CSS overrides.

## 1. Scope, method and evidence limits

Inspected the actual React implementation, every frontend source module, shared stylesheet, Vite proxy, API transport, form/recovery paths and all thirteen browser test files. Inspected MedReach's actual client components, routes, auth provider, form fields, dialogs, filters, workbench and relevant tests/CSS read-only. README and historical handoffs were supporting context, not the primary evidence.

Repository: `feature/forgequote-visual-v2`, HEAD `a9fb910`. Existing uncommitted visual-v2 work was preserved. Only this new report and ignored audit artifacts were created by this audit; no application code was edited.

Evidence labels used below:

- **L - live:** current app at `http://127.0.0.1:5173`, using existing valid anonymous/Estimator sessions. No new login/logout, business POST, provider call, upload POST or database record was performed.
- **S - source:** actual component/state/CSS implementation reviewed, including conditions not safely reachable without writes.
- **H - historical capture:** existing actual Chrome screenshots in `.tmp/visual-v2/`, generated during the previous implementation verification. These are not a fresh live Sales Head or issuance test.
- **T - test inspection:** assertions and fixtures reviewed; database/browser suites were not rerun because they create disposable records/databases and that is outside this audit's no-record instruction.

The live audit captured **76 fresh screenshots**, including desktop 1440x1000, landscape tablet 1024x768, portrait tablet 768x1024, mobile 390x844 and narrow reflow 320x740. No page-level horizontal overflow was observed in the inspected states. Tables intentionally scroll within their regions. One additional screenshot records the persistent lifecycle error after recovery.

The local data available at audit start included two RFQs, one saved quotation, no lifecycle events and no RFQ outcomes. There was no valid existing Sales Head session. Sales Head review, authoring and terminal outcomes were therefore inspected in S/H/T, rather than creating a new session or record. AI and Excel result states and issuance were also S/H/T; source-entry surfaces were live. This distinction prevents a code review from being misrepresented as an executed workflow test.

Database inspection connections forced read-only transactions. Browser automation allowed only GET/HEAD API traffic; no mutating API request was attempted. Before/after business counts remained 2 users, 2 RFQs, 1 quotation version, 0 events and 0 outcomes. No credentials, cookies, tokens, environment contents or source-document contents were printed. Session credentials were used only in memory to reuse existing sessions.

Audit evidence:

- [Live measurements and reproduction results](../.tmp/ux-audit-2026-11-09/live-findings.json)
- [Follow-up feedback and input-boundary checks](../.tmp/ux-audit-2026-11-09/followup-findings.json)
- [Browser-test inventory](../.tmp/ux-audit-2026-11-09/test-inventory.json)
- Live screenshots: `.tmp/ux-audit-2026-11-09/live/`
- Earlier role/state screenshots: `.tmp/visual-v2/ui/`, `review/`, `lifecycle/`

## 2. Complete screen and workflow inventory

These are surfaces and workflow states, not twenty separate routes. The application currently has three principal route forms plus in-page/intake states.

| Surface/workflow | Role and entry | Component/data owner | Important states | Evidence |
| --- | --- | --- | --- | --- |
| Login/session bootstrap | Anonymous, any route | `App` in `main.jsx` | Loading session, role selection, required password, submitting, wrong credentials, service failure/reload, expiry notice | L/S/H/T |
| Authenticated shell | Both roles | `App`; raw hash tracking | Active links, actual identity/role, synthetic notice, sign-out busy/error, mobile nav | L Estimator; S/H/T both |
| RFQ register | Both, `#` | `Workspace`; GET `/rfqs` | Loading, empty, populated, read failure/reload, post-create success | L populated/error/recovery; S/H/T empty/success |
| Pending approval queue | Sales Head, `#approvals` | `PendingApprovals` inside register | Loading, empty, populated, refresh/error | S/H/T |
| Manual RFQ header | Estimator, New RFQ local state | `RfqCreate` | Reference/customer/date, rate-key loading/error, save/review controls | L/S/H/T |
| Component editing | Estimator, intake | `RfqCreate` | 1-20 parts, add/remove, missing-field list, suggestions, copy common keys, final review | L local edits; S/H/T save/recovery |
| Excel source/import review | Estimator, intake disclosure | `RfqDocumentImport` | File/attestation, validation/cancel/error, worksheet/cell evidence, apply, manual fallback | L source; S/H/T parse/results |
| Pasted-text/Gemini source | Estimator, intake disclosure | `RfqExtraction` | Configuration, source length, two consent gates, busy/cancel, provider error/manual fallback | L source; S/H/T provider states |
| Gemini evidence review | Estimator, extraction result | `EvidenceFields`, `EvidenceSource`, `evidenceSlice` | Suggested/raw/normalized fields, issues, exact quote highlighting, return focus, invalid evidence, apply | S/H/T |
| Multi-part rate-key assignment | Estimator, intake with 2+ parts | `RateKeyMatrix`; parent owns all values | Six categories per part, missing rate warnings, controlled selects, horizontal scroll | L/S/H/T |
| RFQ detail/context | Both, `#rfq=<id>` | `RfqWorkspace` | Loading/error, customer/due/assignment/RFQ status, part facts, refresh, unsupported route warning | L/S/H/T |
| Costing working inputs | Estimator, detail | `RfqWorkspace` | Pricing date, margin/routing/three quantities, new calculation, saving, locked/rejected/uncertain/saved/replay, storage failure | L reads/local edits; S/H/T write states |
| Saved-version selection | Both, `#rfq=<id>&version=<id>` | `RfqWorkspace` | None selected, loading/error, version identity guard, historical/current versions | L one version; S/H/T multiple/races |
| Saved annual baseline | Both, selected version | `QuoteResults` summary mode | Immutable saved combined annual value and version context | L/S/H/T |
| Costing/scenario results | Both, selected version | `QuoteResults` | Per-part cost lines, 50/100/150 scenarios, annual totals, illustrative GST, provenance disclosures | L/S/H/T |
| Sales Head saved inputs | Sales Head, selected version | `SavedCostingInputs` | No selection/loading, read-only saved routing/margin/time/setup/quantities | S/H/T |
| Approval/lifecycle | Both with role-specific actions | `QuoteLifecycle` | Draft/pending/approved/rejected/issued/superseded, refresh, storage block, uncertain action/retry, event ledger | L draft/error; S/H/T remaining |
| Issuance confirmation | Eligible Estimator | `IssueConfirmation`, parent submission guard | Cancel initial focus, Tab wrap, Escape, exact version/value, confirm, recovery after response loss | S/H/T |
| PDF downloads | Both; customer PDF eligible issued/current only | `QuoteLifecycle` | INTERNAL versus customer, loading/error/retry, filename, issued-only availability | S/H/T; buttons viewed live, no download requested |
| Rate catalogue/history | Both, `#view=rates` | `RateCatalogue` | Date/category filters, loading/error/empty/missing history, exact precision disclosure, history expansion | L/S/H/T |
| Rate version authoring | Sales Head, catalogue | `RateAuthor`, `useRecordedAction` | Existing key/value/date/reason, native validation, busy, known rejection, uncertain exact-request retry | S/H/T |
| Won/lost outcomes | Sales Head, issued RFQ detail | `RfqOutcome`, `useRecordedAction` | Won, lost with required reason, terminal history, uncertain request/recovery | S/H/T |
| Shared recovery and feedback | All feature surfaces | Feature owners + `api.js` | Read failures, auth expiry, submitted-intent storage, no blind write retry, manual fallback | L/S/H/T with limits above |

No separate tenant/organization management, member invitations, settings, user administration, notification center, account recovery, ERP or analytics workflow exists. They must not appear as fake navigation or controls during a visual redesign.

## 3. Frontend architecture assessment

### Routing and page ownership

`main.jsx` subscribes to the raw hash to choose active navigation. `Workspace.jsx` separately subscribes and parses it with `URLSearchParams`. New RFQ is `creating` React state, not a route. Approvals is an anchor/section of the register, not a separate page. Rates and RFQ detail are conditional returns from the same component.

This is small and dependency-free, but navigation intent has two implementations. Intake has no browser-history entry, unknown hash views fall back to the register, document title stays `ForgeQuote`, and page changes do not intentionally focus/announce the new heading. A growing application needs one small route parser/navigation contract before adding more views. A router dependency is not required for the next slice.

### State and request ownership

The architecture correctly keeps input ownership in the parent: `RfqCreate` owns parts/review/keys; `RateKeyMatrix` is a view of those same values; `RfqWorkspace` owns costing intent and snapshot selection. Snapshot reads are guarded against late responses, stale metadata and mismatched version IDs. Preserve those protections.

The cost of the current structure is many independent loading/busy/error/data booleans and repeated request effects. Lifecycle, RFQ status, register and approval refreshes do not share an invalidation contract. Some read-success paths do not clear previous errors. Ordinary unsent edits are not protected by the submission-recovery mechanism.

Do not replace the feature state with one generic global store. Extract small read-state helpers and explicit working-draft state only as each screen is improved. Keep domain-specific write/recovery contracts intact: RFQ creation, quotation creation, lifecycle, rate authoring and outcomes have different accepted rejection/replay rules.

### Network and recovery

`api.js` correctly sends same-origin credentials and explicit CSRF/idempotency headers. XLSX and PDF intentionally use specialized binary/raw fetch paths. Reads can be cancelled with AbortController. Do not force binary requests through a JSON-only abstraction.

The transport's generic read error includes saving/replay instructions. The screen should distinguish a failed read from an uncertain write without exposing database internals or changing server contracts. Show exact stored request intent safely when a write must be recovered; do not invite another unrelated action or silently issue a new key.

### Styles and presentation primitives

`styles.css` has 680 lines and 16 media-query blocks, combining base styles, earlier Drafting Sheet refinements and visual-v2 overrides. For example, generic `button` rules occur three times and `.login-panel` has five rule groups. Structural and appearance rules are interleaved; broad selectors such as `details`, `summary`, `.lifecycle` and `.input-grid` serve unrelated contexts. `RateAuthor` reuses the lifecycle class, so lifecycle styling can affect rate authoring.

Consolidate in place into tokens, base controls, layout and feature sections with one authoritative rule per variant. Introduce a few shared primitives rather than a new framework or a large component library. Keep native selects/details/dialog unless a demonstrated task requires a richer control.

### Component disposition

| Component/module | Recommendation |
| --- | --- |
| `ScrollTable` | Reuse its measured overflow, named region and keyboard scrolling. Add task-specific mobile presentation around it; do not remove financial table semantics. |
| `Identifier` | Reuse disclosure; increase target area and add contextual labels. Optional copy action only with actual clipboard success/failure feedback. |
| `format.js` | Reuse unchanged string-safe money/rate grouping and Kolkata timestamps. No `Number`, `parseFloat`, client pricing or chart normalization. |
| `evidence-display.js` / `EvidenceSource` | Reuse exact UTF-16 slice verification, safe React text rendering and return focus. Never fuzzy-match or persist raw source. |
| `IssueConfirmation` | Reuse native modal behavior, exact-snapshot binding and cancellation tests. Keep the parent's synchronous duplicate-confirm guard. |
| `RateKeyMatrix` | Reuse the single parent state. Add a per-part mobile adapter if approved; do not create another assignment state. |
| `QuoteResults` / `SavedCostingInputs` | Keep immutable snapshot-only data sources. Extract baseline/summary presentation for clarity, with explicit working-versus-saved labeling. |
| `App` | Separate shell/branding/login presentation from session orchestration. Keep auth behavior unchanged. |
| `Workspace` / `RfqWorkspace` | Split route resolution, register view and detail view; retain snapshot read tokens, abort guards and exact pending bodies. |
| `RfqCreate` | Separate header, component navigator, part editor and review/actions while retaining one form owner and reset-review-on-change behavior. |
| `RfqExtraction` / `RfqDocumentImport` | Share source/review layout and feedback primitives, not provider-specific logic or transport. Keep distinct disclosures and apply semantics. |
| `QuoteLifecycle` / `PendingApprovals` | Separate queue and decision/download presentation. Give reads consistent loading/error clearing and refresh dependencies. |
| `FinalWorkflows` | Extract `RateAuthor` and `RfqOutcome` presentation; retain the recorded-action contract. Add visible pending intent and terminal-action review. |
| Shared additions | Small `PageHeader`, `Field`/error association, `ActionButton`, semantic badge, read-state notice, recovery notice and navigation guard. Avoid one all-purpose component with dozens of flags. |

## 4. Findings and priorities

P1: fix before investing further in presentation or relying on the flow for sustained estimating. P2: important usability/accessibility/maintenance improvement. P3: later scale/product work. These are audit priorities, not claims that all findings are financial/security defects.

| ID | Priority / evidence | Finding and consequence | Proposed treatment |
| --- | --- | --- | --- |
| UX-01 | P1 / L,S | Unsaved margin `17.25` becomes `20` after visiting rates and returning; no navigation warning. Submission recovery does not protect ordinary edits. | Explicit dirty state and leave/stay handling for internal navigation and tab close. Do not persist raw source or change a pending request body/key. |
| UX-02 | P1 / L,S | An unsaved intake reference disappears after opening an RFQ and returning. `creating` remains true, but its remounted form is blank. | Make intake an explicit navigation state and protect its one form owner; restore or deliberately discard draft values. |
| UX-03 | P1 / L,S | RFQs link during intake keeps the form open because the hash is already `#`. Browser history also cannot represent the intake step. | One route/navigation contract; explicit handling of current-destination clicks, Back, Cancel and legacy anchors. |
| UX-04 | P1 / L,S | After an induced lifecycle GET failure, a successful refresh returns HTTP 200 but the error alert remains visible. | Clear read errors on new attempt/success; distinguish refreshing, stale data and failure. Keep write failure/replay state separate. |
| UX-05 | P1 / S | Register data loads on mount/its refresh counter. Detail lifecycle/outcome success does not invalidate that retained list. Lifecycle issuance also does not automatically refresh the RFQ title status. | Scoped GET refresh/invalidation after known successful actions and on relevant navigation; preserve unsaved inputs and selected-version guards. No automatic POST retry. |
| UX-06 | P1 / L,S | At 390px, the register is 850px wide inside a 354px region; Open RFQ is at the far right. Normal task entry requires horizontal discovery/scrolling. | Make the reference a meaningful primary link or use mobile operational rows with a visible Open action. Preserve full desktop table access. |
| UX-07 | P2 / L,S | Required-form feedback begins as long red lists before interaction. Native input validation accepts weight `0`, cycle `0`, and quantity `1000000001`, despite documented limits. Server validation remains authoritative. | Neutral completeness until interaction; inline field errors + focusable summary; mirror documented bounds using string-safe checks without pricing arithmetic. |
| UX-08 | P2 / L,S | A filled draft part disappears immediately when removed, without undo or review. Apply-common/apply-import/apply-AI deliberately replace existing values, but have no review diff/undo. | Lightweight undo for local removal; clear replacement summary and deliberate confirmation where substantive edits will be overwritten. Always reset estimator review. |
| UX-09 | P2 / L,S | Continue manually closes the disclosure containing its success notice, making the notice invisible; no explicit focus moves to manual fields. | Put fallback feedback outside the closed source panel and focus the relevant manual section. |
| UX-10 | P2 / L,S | Single-part mobile intake is about 3,016px tall; two-part intake about 3,883px. Register remains below intake, increasing noise. | Dedicated intake task composition, compact section progress/part navigator, review summary and accessible action rail. Avoid a mandatory complex wizard. |
| UX-11 | P2 / L,S,H | A saved one-part quotation page is about 3,606px tall on mobile. Saved values, working inputs, lifecycle and results compete in one vertical document. | Explicit Saved version versus Working estimate regions; compact saved context and section navigation. Preserve the selected immutable version while editing. |
| UX-12 | P2 / L,S | Sticky mobile/tablet header is 131px high. Table headings compute to about 8.96px from `.64rem` on a 14px root; mobile identity is similarly small. | Increase readable text tokens; reduce header duplication and account chrome. Use task density rather than tiny text. Small font size alone is not a WCAG failure claim. |
| UX-13 | P2 / L,S | Open links have roughly 16px-high boxes; rate identifier buttons about 18px. Some controls rely on spacing/labels for usable targets. | Larger hit areas, especially mobile. Evaluate actual spacing and equivalent-target exceptions before claiming a standards failure. |
| UX-14 | P2 / S | Rate date/refresh sets `data=null`, unmounting `RateAuthor`; unsent authoring fields can disappear. Catalogue filters are not URL-addressable. | Keep read state separate from authoring draft; warn/preserve ordinary author edits and expose the chosen as-of/category state. Never rewrite an uncertain recorded request. |
| UX-15 | P2 / S,H | Rate authoring exposes a long key option containing unit/latest date, with no concise old/new effective-value preview. A future latest start is explained in prose rather than a field-specific rule. | Selected-key facts, exact-value/date/reason review and useful local errors before the same existing POST. Server remains authoritative. |
| UX-16 | P2 / S,H | Mark RFQ won/lost is terminal, but the UI invokes the operation immediately. | Review exact RFQ and terminal meaning before the existing action; Cancel sends no request. Keep lost reason mandatory and no reopening option. |
| UX-17 | P2 / S,H | Internal PDF preparation disables its button without changing its label; a shared download boolean also controls customer PDF feedback. | Explicit per-download progress/status and retry. Keep INTERNAL/customer distinction and issued/current eligibility intact. |
| UX-18 | P2 / S | Recovery locks inputs correctly but often offers only “previous action may have committed,” without a concise review of the stored key/date/value/reason/action. | Read-only recovery summary from the exact recorded intent, separate from editable fields; preserve safe explicit same-request retry. |
| UX-19 | P2 / L,S | No skip link or deliberate route-heading focus/title update. Field-level `aria-invalid` and error associations are largely absent outside login/evidence warnings. | Skip to main, meaningful document titles, focus on route heading, associated field errors and scoped live notices. Do not steal focus after routine data refresh. |
| UX-20 | P2 / S | Unknown routes fall back to register; top-level render errors have no ErrorBoundary. | Friendly unsupported-route/read-failure screens with actual navigation/retry, no silent fallback or automatic mutation. |
| UX-21 | P2 / S,T | CSS layers and repeated effects make small changes difficult to predict. No tracked aggregate browser runner includes all 13 suites; `npm test` runs API unit tests. | Consolidate styles incrementally; add a documented test entry point in a separately approved implementation slice. |
| UX-22 | P3 / L,S | No register search/filter/sort or normal populated-state refresh; catalogue has category/date but not key search. | Lightweight controls over already returned fields with truthful result counts. Do not describe client-only filtering as server pagination or invent quote statuses absent from the response. |
| UX-23 | P3 / S | No tenant context/membership/invitations or real account-management model. Demo role selection is appropriate only for the demo. | Treat multi-tenant identity/isolation as a separately approved backend/security workstream. No placeholder organization switcher or fake settings. |

### Exact live reproductions

1. Open an RFQ, type margin `17.25`, visit Rate catalogue, use browser Back: margin is `20`; no warning appears. No save is attempted.
2. New RFQ, type a reference, open an existing RFQ from the retained register, choose RFQs: intake is open again but reference is empty.
3. While New RFQ is open at `#`, click RFQs: URL and intake remain unchanged.
4. On a saved draft, abort only lifecycle GET in the audit browser, press Refresh lifecycle, then restore the GET and refresh again: response is 200; the error alert remains.
5. Add a second draft part, enter a part number, remove it: part count drops immediately; no confirmation/undo is offered.
6. Inspect native input validity without submission: zero weight, zero cycle and quantity 1,000,000,001 are accepted by the browser constraints.
7. Open AI source, press Continue manually: the explanatory notice is in the now-closed disclosure and is not visible.

These reproductions changed only isolated browser-memory drafts. No record was saved and no provider was invoked.

## 5. Responsive and accessibility review

### What works

- Dark-surface text and semantic tokens have a useful contrast foundation; prior focused tests cover 35 token/state pairs. Crimson is confined to branding rather than default actions/statuses.
- No page-level horizontal overflow was observed at the five inspected widths. Financial/history/matrix data are contained in named keyboard-focusable scrolling regions.
- Native labels, form elements, details and modal semantics already exist. Login errors have an alert and password description association.
- Source highlight and Return to field preserve a useful keyboard review path. Native issuance focuses Cancel and traps Tab/Shift+Tab; cancellation creates no write.
- Reduced-motion rules disable transitions/animations. A follow-up 22-step native keyboard traversal found no fully obscured focused control beneath the mobile header in that inspected sequence; this is not a full focus-conformance audit.

### What needs improvement

- At 1024px the fixed 208px sidebar leaves only about 742px for the register's 850px table. At 768px the 131px stacked header consumes substantial height and Open RFQ is still horizontally out of view. The absence of body overflow does not prove a task is comfortable to complete.
- Mobile cost comparison is 650px wide in a roughly 322px viewport region; matrix is 1040px wide in roughly 320px. Keep a comparison table, but provide an immediately visible 100% saved scenario summary and optional per-part/mobile assignment presentation from the same state.
- Mobile/narrow login retains a large introduction before the form. The 390px page is 944px tall; the CTA is reachable, but the introduction can be more compact on short screens without losing branding/disclosure.
- There are no tablet-targeted browser-suite assertions in the existing thirteen files. Previous visual checks emphasize 1440/390px and some 320px states, leaving breakpoint transitions under-tested.
- Test actual text at 200%/400% zoom, long supported identifiers/descriptions, keyboard-only primary tasks, focus under sticky surfaces and native mobile keyboard interactions before claiming accessibility conformance. Physical devices, Safari/Firefox, screen readers and full contrast sampling were not covered by this audit.

Standards interpretation: WCAG 2.2's minimum target-size criterion allows spacing, inline and other exceptions; the 16/18px measurements above are usability risks, not automatic violations. See [W3C target size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Focus must not be entirely hidden by authored content; see [focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html). Data tables can legitimately require two-dimensional scrolling, while surrounding content should reflow; see [reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

## 6. Loading, empty, error, success and recovery contract

| State | Existing strengths / weakness | Proposed common treatment |
| --- | --- | --- |
| First read | Plain loading status exists; layout often has little reserved structure | Stable region size, concise status; optional static skeleton with reduced-motion support |
| Refresh | Some reads retain old values; others unmount whole regions; errors can survive success | Keep useful previous data explicitly marked while refreshing; clear read error on retry/success |
| Empty | RFQ and approvals have real empty copy; no filtered-empty distinction | Separate no records from no matches; show only actions the role can actually perform |
| Read failure | Reload controls exist, but generic text talks about saving | Task-specific read error + retry; no submission-key instruction for a read |
| Known validation rejection | Server message visible, mostly no field association | Error summary + associated local field errors; preserve values and reviewed-state semantics |
| Busy mutation | Disabled controls and human labels exist; consistency varies | Specific action label/status; prevent repeated activation; do not disable unrelated read-only navigation without reason |
| Success | Notices often appear, but focus/next action varies | Persistent local confirmation and a useful next action; after RFQ save, expose the actual saved RFQ directly instead of asking the user to search the register |
| Unknown write outcome | Exact key/body retained and input locked; this is a strength | Prominent read-only stored-intent summary, same-request recovery only; no new-intent shortcut until resolved |
| Storage failure | Writes blocked rather than silently losing protection | Preserve that block; explain safe recovery in user language, never advise clearing storage blindly |
| Auth expiry | Reauthentication and submitted-request recovery exist | Distinguish retained submitted intent from unsent edits; no promise that raw source was saved; never expose one user's draft to another identity |
| Provider/import failure | Manual fallback exists; its local feedback can be hidden | Keep fallback always available and move focus/notice to manual input; retain full provider disclosure and both consents |

## 7. MedReach reference findings

Inspected `client/src/App.jsx`, `AuthProvider`, `ProtectedRoute`, `FormField`/`PasswordField`, `AuthPageFrame`, `LoginPage`, `DoctorResultsPage`, `DoctorFilters`, `DiscoveryControls`, `ClinicalWorkspace`, `CancellationDialog`, `useModalDialog`, `PublicHeader`, `StatusBadge` and associated tests/CSS. No MedReach file or database was modified; its application was not started.

| Useful pattern | ForgeQuote adaptation | Do not copy |
| --- | --- | --- |
| FormField has label/hint/error structure; password control has explicit show/hide | Consistent associated errors/hints; optional accessible password reveal | Its password limits or authentication rules; ForgeQuote's contract differs |
| Results filters live in URL with reset/clear and request identity | Shareable catalogue filters and sensible register controls over existing data | Healthcare filters, unsupported server pagination assumptions or broad router migration |
| Clinical workbench distinguishes dirty/editable/read-only and explicit completion | Separate Working estimate from Saved version; show unsaved status and deliberate final actions | Medical forms, domain language, implicit financial save-on-finish behavior |
| Dialogs guard pending actions and return focus; small-screen composition is considered | Consistent cancel/confirm/reason layout and focus behavior | A custom role=dialog replacing ForgeQuote's working native modal/inert behavior |
| ProtectedRoute separates loading, session failure, role denial and return destination | Clear frontend session/read failure presentation and route context | Treating frontend role routing as authorization, or changing server session/CSRF |
| Discovery controls account for clipping, Escape, outside dismissal and viewport bounds | Use those interaction requirements if key volume later justifies a searchable picker | The entire custom date/select implementation when native controls suffice |
| Focused component tests verify dirty-state failure and final-action boundaries | Add interaction-specific regression tests per milestone | Copying its stack, Tailwind setup, images, colors or notification features |

## 8. Proposed design system

This is a refinement of the approved identity, not a new theme.

| Layer | Proposed contract |
| --- | --- |
| Brand colors | Charcoal `#171717`; forest `#06110C`; ivory `#FAF8F3`; crimson `#A31C1B` as restrained brand accent |
| Surfaces | Canvas, panel, raised, selected forest; one structural border token and a distinct accessible control-boundary token |
| Actions | Ivory primary; neutral outlined secondary; clearly labeled danger treatment; one primary next action per task region |
| Semantics | Error/success/warning/pending tokens paired with text; distinguish source verification from human approval through explicit context |
| Typography | Keep local Segoe UI/system fonts. Prefer user-relative root sizing; body 14-16px, tables/labels 13-14px, essential metadata at least 12px as a product target, page titles 28-36px. Decorative captions may be smaller. Tabular numerals for stored values. |
| Spacing | 4/8/12/16/20/24/32/40px rhythm; compact 44-52px operational rows, comfortable forms without nested panel padding at every level |
| Shapes | 5-6px inputs/buttons, 8px surfaces, 10px modal; restrained rules rather than heavy shadows or pills everywhere |
| Controls | Native input/select/date/file/checkbox by default; field labels above controls, units adjacent, explicit required/optional cues, local hints and associated errors |
| Focus/targets | Keep 3px visible focus; aim for 44px mobile primary controls and generous hit areas around small table actions; maintain native keyboard behavior |
| Tables | Contextual header/count/filter rail; clear row action; numerical alignment; proper headings; named overflow; purposeful mobile adapter for operational lists |
| Feedback | Shared read-state and operation notices; explicit refreshing/stale/recovered labels; no success toast as the only evidence of a saved operation |
| Motion | 120-160ms color/border changes only where helpful; reduced-motion honored; no neon/glow/decorative charts |
| Responsive layout | Desktop workspace, content-aware tablet collapse, compact mobile shell. Use one shell-height token for scroll offsets rather than unrelated 128/135/150px constants. |

Do not add a new dependency, remote font, library or design-token framework by default. Validate final rendered combinations, not only hex values from a token list.

## 9. Screen-by-screen redesign proposal

| Surface | Proposed composition and interaction | Preserve |
| --- | --- | --- |
| Login | Retain editorial split/original drawing; tighten short-screen introduction, improve form cues and optional password reveal; announce errors without losing role context | Demo identity names, password clearing, session bootstrap/CSRF, factual disclosure |
| Shell/navigation | Compact brand/nav/account composition, skip link, role label with readable text, one active-route source, explicit intake/approvals destinations | Existing links, roles, sign-out and pending-form protection |
| Register | Task header with New RFQ, meaningful count, optional search/status/owner controls using existing fields, ordinary refresh; mobile reference/action immediately visible | RFQ status remains RFQ status; no invented quotation lifecycle state |
| Approval queue | Dedicated task view or unambiguous anchor behavior, compact saved-value review rows, useful empty/refresh/error states; mobile Review always visible | Exact saved annual value/version and server Sales Head authority |
| RFQ detail | Short context header and part list; clear selected saved version; navigable sections for inputs/results/history | Real assignment, due date/status/outcomes, selected-version read guards |
| Costing workbench | Explicit Working estimate/unsaved state; compact per-part editing and scenario quantities; clear relationship to visible saved results | No automatic recalculation/save; exact string inputs; fresh-key intent and locked uncertain body |
| Results | Saved baseline and per-part 100% headline immediately understandable; comparison table available; mobile saved scenario summary before optional full comparison | Snapshot-only output, all cost lines, illustrative GST, provenance and exact formatting |
| Manual intake | Dedicated task area with RFQ details, components/rates and final review sections; part navigator/progress; undo local removal; save next action points to actual saved RFQ | One RfqCreate state, explicit keys, 20-part bound, review reset and exact recovery |
| Excel | Clear Choose -> Review cells -> Apply to manual sequence; concise source requirements and visible fallback/apply feedback | Synthetic attestation, deterministic import, header preservation, key clearing and final human review |
| Gemini | Clear source/consent, proposed fields, unresolved items and exact-source panel; meaningful field context and short navigation to next unresolved item | Full terms/disclosures, two explicit consents, source not persisted, no confidence invention, no pricing |
| Matrix | Full six-key desktop comparison; per-part mobile editor or visible row details from same parent values; selected full code/unit readily available | No automatic selection; category validity, effective-rate warnings and review reset |
| Rates/history | Readable as-of/category/key context, compact rows, deliberate history expansion; filters maintained in navigation | Exact stored decimals/history; start-inclusive/end-exclusive dates; missing-rate error |
| Rate authoring | Distinct authoring section with selected-key current/latest facts, field errors and exact old/new/date/reason review; protect unsent edits | Same append-only POST, role, effective-date policy and same-key replay |
| Sales Head saved-input review | Read-only saved-version header, per-part saved values and direct section navigation to matching costs/provenance | No editable RFQ defaults masquerading as saved inputs |
| Lifecycle/PDF/outcomes | Status + eligible next action + event history, separate document progress, persistent recovery intent; terminal-outcome confirmation | Version-bound approval, issuance modal, server eligibility, INTERNAL/customer confidentiality and no reopening |

## 10. Existing test coverage and missing gates

Thirteen browser suites were inspected: auth, quotation, RFQ, AI, Excel, AI association, lifecycle, PDF, rates UX, final workflows, focused UI, version consistency and visual-v2. The first ten are the established workflow set. There are also three display-format and two evidence-helper unit tests.

Strengths: real PostgreSQL/browser workflows, independent golden values, response-loss recovery, auth expiry, role denial, stale-version eligibility, delayed response consistency, PDF attachments, provider failure/manual fallback, exact source offsets, keyboard table scrolling and modal focus/cancellation. Keep these assertions; changing selectors should not weaken their meaning.

Gaps:

1. No existing suite tests ordinary unsaved navigation loss, same-hash intake navigation or filled-part undo.
2. No explicit tablet viewport coverage in the thirteen browser files; limited breakpoint-boundary and short-landscape coverage.
3. No regression for a successful lifecycle read clearing its prior error, dependent register invalidation or manual-fallback notice/focus visibility.
4. No comprehensive field-boundary/inline-error interaction coverage; server financial tests do not prove frontend validation usability.
5. Contrast tests check selected tokens/state pairs; they are not full computed-DOM, focus-obscuring, target-spacing or screen-reader audits.
6. No systematic keyboard-only complete workflow or 200%/400% zoom gate. A few focused keyboard checks are useful but not equivalent.
7. No single tracked command runs all thirteen browser suites; focused UI/version/visual suites are absent from root npm scripts. Some local orchestration currently lives only in ignored helpers.
8. No cross-browser/device coverage was found in this frontend test setup. Do not claim accessibility or device conformance from Chrome screenshots alone.

No suites that write fixtures were executed during this audit. Historic green results remain prior evidence, not a newly executed complete regression.

## 11. Prioritized implementation roadmap

Each milestone is an independently reviewable vertical slice. Start only after approval of that milestone's concrete files/data flow/tests. Keep application/API/security/financial contracts unchanged. No commit/deploy authorization is implied by this audit.

| Milestone | Priority / scope | Principal files | Independently testable acceptance |
| --- | --- | --- | --- |
| M1 - navigation, draft protection and honest read feedback | P1 first. One route source; explicit intake navigation; dirty leave/stay handling; clear successful refresh errors; scoped read invalidation | `main.jsx`, `Workspace.jsx`, `QuoteLifecycle.jsx`, small route/read-state/guard helpers | Reproduce UX-01..05 as red tests first; same-hash click works; Back/Cancel is deterministic; unsent edits retained or deliberately discarded; successful GET removes prior error; no POST on navigation; all exact-key/version tests preserved |
| M2 - shared design system and login/shell | Consolidate existing tokens/CSS; reusable fields/notices/actions; readable typography, skip link/focus/title; compact header/login | `styles.css`, login/shell presentation, small UI primitives | Computed contrast/focus checks, native keyboard order, no selector regressions; 1440/1024/768/390/320px plus breakpoint boundaries; reduced motion; login auth suite unchanged |
| M3 - register and approval queue | Task-oriented lists with visible mobile entry/review, actual loaded-data filtering, empty/error/refresh states | register/queue views, `ScrollTable`, scoped list styles | Both-role visible actions at 390px without horizontal hunting; correct existing fields/statuses, no-match versus no-record states, URL/back behavior, read retries, no fabricated metrics or new API |
| M4 - detail, working estimate and saved results | Explicit unsaved versus immutable regions, selected-version context, compact part/scenario workflow and mobile results | `Workspace`, `QuoteResults`, `SavedCostingInputs`, `format` reused | Existing nine goldens unchanged; no Number coercion; delayed historical-version suite stays green; editing never changes saved values; useful mobile 100% summary and keyboard comparison |
| M5 - manual intake and rate assignments | Section/part navigation, field bounds/errors, safe removal/replacement, mobile matrix, final review/next-step clarity | `RfqCreate`, `RateKeyMatrix`, field/review primitives | 1/2/20-part cases in disposable approved fixtures; correct input bounds; undo returns exact draft fields; copy/apply resets review; single parent state; same-key lost-response recovery unchanged |
| M6 - Excel/Gemini evidence and fallback | Clear source/review/apply sequence and visible fallback focus; concise unresolved-field navigation | `RfqDocumentImport`, `RfqExtraction`, `EvidenceSource`, helper reused | No provider calls in deterministic tests; consent gates unchanged; wrong offsets never highlight; source not persisted; Excel cell quotes exact; applying preserves/replaces the documented fields only; manual fallback notice visible/focused |
| M7 - rates, decisions, documents and terminal review | Protect authoring draft, exact rate preview/recovery, clear decision/download progress, terminal won/lost confirmation | `RateCatalogue`, `FinalWorkflows`, `QuoteLifecycle`, existing modal primitive | Both-role read/write boundaries preserved; future-date/precision validation; Cancel sends no POST; unknown outcomes retain exact intent; issuance double-confirm guard and PDF eligibility/confidentiality tests unchanged |
| M8 - acceptance and scale-readiness handoff | Full cross-surface quality gate; tracked regression entry point and final screenshots | Tests/scripts/docs; limited polish fixes | All ten workflow plus focused suites; financial/API regression on approved disposable fixtures; build/startup; desktop/tablet/mobile/zoom/keyboard checks; no body overflow; detailed screenshot/handoff and stop for review |

M1 is the recommended first approval request because it fixes confirmed loss/confusion without waiting for a new visual system. M2 establishes stable primitives before the larger screen refinements. M5 and M6 remain separate so evidence/consent behavior is not tangled with manual-form refactoring. M7 must not silently alter irreversible business rules. M8 is a release-candidate gate, not permission to deploy.

Future multi-tenant work requires a separate architecture/security plan: organization/membership identity, server-enforced isolation, tenant-scoped reads/writes/rate masters, tenant-aware recovery keys and cross-tenant denial tests. A frontend tenant picker alone provides none of that. Server pagination, accounts/invitations and organization settings are outside these frontend milestones until separately approved.

## 12. Screenshot review index

| Evidence | Desktop / tablet | Mobile |
| --- | --- | --- |
| Current register | [1440](../.tmp/ux-audit-2026-11-09/live/register-1440.png), [768](../.tmp/ux-audit-2026-11-09/live/register-768.png) | [390](../.tmp/ux-audit-2026-11-09/live/register-390.png) |
| Current saved workbench | [1024](../.tmp/ux-audit-2026-11-09/live/detail-saved-1024.png) | [Full 390](../.tmp/ux-audit-2026-11-09/live/detail-saved-390-full.png) |
| Manual intake | [1440](../.tmp/ux-audit-2026-11-09/live/intake-1440.png) | [Full 390](../.tmp/ux-audit-2026-11-09/live/intake-390-full.png) |
| Multi-part intake | [768](../.tmp/ux-audit-2026-11-09/live/multipart-intake-768.png) | [Full 390](../.tmp/ux-audit-2026-11-09/live/multipart-intake-390-full.png) |
| Rates/history | [1024](../.tmp/ux-audit-2026-11-09/live/rates-1024.png) | [390](../.tmp/ux-audit-2026-11-09/live/rate-history-390.png) |
| Login | [1440](../.tmp/ux-audit-2026-11-09/live/login-1440.png) | [390](../.tmp/ux-audit-2026-11-09/live/login-390.png), [320](../.tmp/ux-audit-2026-11-09/live/login-320.png) |
| Persistent recovered-read error | - | [390](../.tmp/ux-audit-2026-11-09/live/lifecycle-error-persists-390.png) |
| Sales Head review - earlier real capture | [1440](../.tmp/visual-v2/ui/sales-review-1440.png) | [390](../.tmp/visual-v2/ui/sales-review-390.png) |
| Gemini exact-source review - earlier real capture | [1440](../.tmp/visual-v2/review/gemini-evidence-1440.png) | [390](../.tmp/visual-v2/review/gemini-evidence-390.png) |
| Issuance - earlier real capture | [1440](../.tmp/visual-v2/lifecycle/issuance-1440.png) | [390](../.tmp/visual-v2/lifecycle/issuance-390.png) |

The audit is complete. No implementation, database changes, test-record creation, API/security/financial change, commit, push, merge or deployment was performed. Await owner approval for the chosen milestone.

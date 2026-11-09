# Learning log — fill during the build

## 2026-11-09 - Terminal closure is a shared write invariant

- An append-only terminal outcome does not automatically freeze related append-only quotation tables. Put the invariant at both API and SQL boundaries, while preserving receipt lookup before new-write eligibility.
- Opposing operations must share the same entity lock and lock order. Reusing the quotation header avoids a new lock namespace and avoids inversion between API allocation, SQL triggers and closure. Test both commit orders, not only simultaneous Promise.all success counts.
- Row locking alone does not refresh a repeatable-read snapshot when the row was not updated. A permanent regression reproduced a direct SQL bypass; fail closed for those stronger-isolation writes rather than silently accept stale outcomes. Existing READ COMMITTED application transactions remain unchanged.
- Historical compatibility is a testable property: build a synthetic 001-007 history with Won before a newer issued Version 3, apply 008, and compare snapshots, history and actual PDF bytes. Prospective enforcement does not require rewriting old records.
- Closed UI must preserve recovery controls and retained values while removing instructions to create or issue new versions. A stale tab still needs a backend conflict; visual hiding is never the enforcement boundary. See ADR 0028 and the terminal-closure handoff.
- Final local gates passed: 22 browser suites, 197 API/database tests, 90 units, 24 frontend helpers, 33 financial tests/nine unchanged goldens, syntax/build/startup. Desktop/tablet/mobile screenshots were inspected. No development/production database, cloud, Git publication or deployment operation was performed.

## 2026-11-09 - Branding without concealing demonstration boundaries

- Product naming and data policy are separate. Present ForgeQuote consistently while explaining the two shared accounts and their common synthetic-record access once on login; keep a short data reminder and all context-specific provider warnings. Do not imply tenant isolation or real customer accounts.
- Remove the obsolete login badge rule and the two selectors that hid its old companion text; leaving those selectors would hide the sole remaining metadata label on mobile/tablet. Keep tokens, layout and original assets intact.
- Changing the visible accessible label to Account requires matching browser selectors, not changes to username IDs, role values, authentication or provisioning. Keep historical seeded names/PDF data and deployment URLs unchanged. Exact evidence and remaining limits: `branding-handoff.md`.

## 2026-11-09 - Subsequent F2 correction: one owner for metadata read errors

- A reader's sequence guard does not protect an unconditional catch in its caller. The reader rethrew an obsolete failure after correctly ignoring it; the save callback then published that failure into the unrelated action error state.
- Reusing `refreshRfq()` preserves both existing metadata requests, consumes rejected promises and keeps current failures in `readError`. Do not clear shared mutation errors on GET success; that could conceal a genuine uncertain write. Independent saved-snapshot failures also keep their own recovery path.
- A permanent controlled-response regression first reproduced the exact stale error. Opposite completion order, successful retry, real disposable-session expiry, late unmount, draft/recovery preservation and unchanged saved financial strings check the boundaries of the fix. The earlier owner deferral remains historical; the new fix is separately authorized and locally verified. See `f2-stale-refresh-error-handoff.md`.
- Full verification exposed an existing M7 assertion observing rate validation before its reset effect completed. A diagnostic saw removal 38 ms later; use a bounded DOM-state wait before the unchanged assertion, without arbitrary sleeps, larger timeouts or application changes. Preserve the failed logs as well as the successful rerun.

## 2026-11-09 - Final audit F1 correction and F2 deferral

- Unknown lifecycle state is not evidence that a remembered rejection reason is inapplicable. Requiring a successful pending read in the dirty marker silently removed unload protection during remount/read failure. A regression reproduced the failure before the narrow fix; preserve protection until confirmed state or explicit clearing justifies removing it.
- Confirmed writes, ordinary memory drafts and durable uncertain-request recovery have distinct lifetimes. Keep immutable-version ownership and existing recovery behavior intact.
- Owner deferred F2: an older post-save metadata failure can display an obsolete error after a newer successful refresh. Saved quotation and financial results remain correct. Local audit evidence does not establish production verification; implementation is unchanged. Final results and rollback: `final-audit-resolution.md`.

## 2026-11-09 - M7/M8 exact review, request ownership and product acceptance

- Catalogue as-of date, server business date and latest future rate start are different concepts. Validate rate starts against API businessDate and every recorded start, never the browser clock. Keep rates as exact strings, including an explicit zero, and let server concurrency rules reject stale previews.
- Preserve existing mutation owners and serialized intent. Read-only recovery summaries must describe the original path/body/key. Confirmation changes when an existing operation is invoked, not its business rules. Synchronous guards prevent duplicate clicks before React updates; server idempotency remains authoritative.
- Remembered rejection/outcome text needs dirty protection even while its screen is unmounted. Native confirmation should begin on Cancel, cycle focus, support Escape and restore its trigger. A successful background read must not erase another resource's error or move focus.
- PDF preparation, lifecycle mutation and read refresh are separate states. Bind binary requests to the selected version and abort on leave; report browser download requested rather than promising disk persistence. Distinguish customer allowlisted documents from INTERNAL saved-cost reports without changing either renderer.
- Full journeys found real navigation friction: add task jumps to approval/documents/outcome and the multipart matrix, and place exact rate preview before the save action. Reuse existing focus/scroll offsets and state owners rather than a new wizard/store.
- Assertions alone missed a blank screenshot at true 400% Chrome zoom. Visual review required native-frame capture, followed by actual image inspection. Render real downloaded PDFs and inspect continuation pages, not just extracted text or screenshots of download buttons.
- Preserve operational limits in tests. Twenty-four downloads by one actor correctly hit the PDF limiter; use the two legitimate roles for their document journeys instead of relaxing the limit. Bind golden assertions to the spindle identity rather than assuming immutable arrays/display ordering.
- Complete and checkpoint M7 before M8. One existing test API shutdown timeout passed on full rerun without changing backend behavior or timeouts. Record this evidence, mocked-provider limits and unverified devices/cloud clearly. Never describe local acceptance as deployment or multi-tenant isolation.


## 2026-11-09 - M5/M6 validation, identity and source review

- Match frontend bounds to the actual backend canonicalizer, including trimmed case-sensitive part uniqueness, exact dates, positive weight/cycle, nonnegative setup and BigInt quantity limits. Validate decimal strings without rewriting them or doing financial arithmetic. A syntactically plausible value can still be outside the documented range.
- Separate UI identity from transport. Stable part UUIDs preserve surviving DOM/state across removal and undo, and source-field target selection must use the same identity so removal never silently redirects an action. UI IDs never enter API bodies or durable submission records.
- Client evidence checks can only reject a server-verified suggestion. Every exact UTF-16 span must still match the submitted source; missing or uncertain fields cannot be guessed. Customer material remains informational. Application, final human review and server-confirmed persistence are separate actions with separate wording.
- Native modal focus restoration needs explicit care when React removes the dialog. Capture the initiating control before opening and restore it after closing. Only deliberate bulk application moves focus into manual validation; background reads and individual application leave focus stable.
- Cancelled requests retain asynchronous finally blocks. Guard results, errors and completion by current-controller identity; release manual controls immediately on cancel. An old completion must never unlock or clear a newer extraction/import request.
- Complete and checkpoint M5 before touching M6. Actual screenshots caught a misleading readiness count for invalid nonempty inputs; count validation issues as well as blanks. Regression also preserved the accepted new-tab Rates action from intake rather than changing product navigation to satisfy an incorrect test assumption.
- Full browser/API/financial tests use disposable local databases and mocked provider responses. Keep development data untouched and distinguish actual production process startup from DB readiness in a deliberately disconnected startup fixture. Preserve prior uncommitted work with exact-byte checkpoints rather than resetting to Git HEAD.


## 2026-11-09 - M4 working inputs and immutable financial review

- Extract only controlled presentation; keep persist-before-POST, exact-key retry, legacy bodies, draft scope and read/version guards with their existing owners. Byte-identical handlers plus lost-response browser recovery demonstrate that a visual extraction did not invent a new data flow.
- Working inputs, known confirmed submissions and the selected historical snapshot are three distinct concepts. Only server-confirmed receipts justify saved wording. Independent metadata success cannot erase a failed snapshot read or leave the new header claiming indefinite loading.
- Show per-unit/annual and ex-GST/GST-component/inclusive scope next to figures. Move persisted annual comparison before per-part detail; mobile adapters read the same snapshot and never calculate totals. Sort copied part arrays for predictable review without mutating saved records.
- Inspect actual narrow screenshots: two money columns caused a final paise digit to wrap at 320px. Full-width value rows plus a browser Range line-count regression fixed readability without rounding/truncation. Keep context selectors stable: a decorative Baseline badge collided with the existing version badge selector, so plain text preserves it.
- Default queue order comes from saved-version creation order, not a submission timestamp absent from the response. Accurate wording avoids invented age/priority claims.
- Complete separate M3 and M4 checkpoints and gates before final handoff. Guard every writable fixture to disposable local databases; preserve development data and all prior uncommitted work. No M5/deployment is implied by completion.


## 2026-11-09 - M3 list state and mobile task entry

- List queries are URL state, not form drafts or authorization. Search replaces history; deliberate filter/sort changes add entries. Auth-scoped destination URLs preserve context without moving workspace ownership.
- Queue filters must use queue response fields; RFQ statuses cannot stand in for quotation lifecycle. Keep server submission order as the default.
- A leading native reference link retains table semantics and a 44px target while removing horizontal hunting and oversized double-line desktop rows. Explicit select labels prevent option text from changing accessible control names.
- M3 verification passes before the M4 checkpoint; a combined approval does not remove the sequential test gate.


## 2026-11-09 - M2 design system and stable shell

- Preserve accepted uncommitted work with a file/hash/status/patch checkpoint before extraction; a reset to HEAD would erase M1. UI-only rollback restores the M2 checkpoint, not the earlier M1 checkpoint.
- Presentation extraction is safe when the workflow owner retains its type/key/position. App still owns auth, while AppShell owns only navigation presentation, title/focus and header measurements. No route key, global form abstraction or new request layer is needed.
- Consolidation removes obsolete declarations and selector/context duplicates before introducing a new styling layer. Structural separators differ from control boundaries, and compact feature variants remain explicit. A user-relative root requires auditing old rem values together.
- A queued resize can run after React clears refs but before passive cleanup. Capture observed elements, check isConnected and test the unmount boundary deterministically.
- Token contrast is insufficient: interpolating foreground and background through a disabled/busy state produced a 1.65:1 intermediate button. Atomic fill/text plus a border-only transition preserves contrast; sample actual request-driven animation frames as well as steady states.
- Genuine Chrome page zoom changes devicePixelRatio and layout viewport. Fresh task-owned host-zoom profiles plus CDP viewport captures verify 200%/400%; ordinary Playwright screenshots at native zoom can crop using CSS coordinates. Keyboard Tab/Shift+Tab verifies actual focus scrolling, beyond fill()'s automation positioning.
- Route focus should respond to deliberate task identity, not metadata refresh or selected saved-version reads. Background authoring refresh retains both its reason and focus. Physical device/screen-reader/cross-browser evidence remains a separate limitation.


## 2026-11-09 - M1 navigation, ordinary drafts and read state

- Submitted-intent recovery does not protect ordinary edits. Keep the exact durable submission protocol authoritative, and use a separate auth-lifetime memory scope for unsent costing inputs. Retain the original intake/rates trees through internal navigation so source/file and authoring state do not acquire another writable model or new persistence policy.
- Navigation must be explicit state: adding an intake hash entry makes RFQs and browser Back/Forward deterministic. Derive active sections from the same parser, and bind intake-only new-tab behavior to the Estimator role so it cannot leak across a sign-in on an old URL.
- Read errors belong to their resources, not a shared error bucket. A successful lifecycle read clears its prior read error, but cannot clear a storage/write error; RFQ metadata success cannot clear a separate failed saved snapshot. Aborted/late reads must not apply data/errors, and read refreshes must not reinitialize forms.
- Put fallback feedback outside the disclosure it closes. Use a fresh notice event even for repeated identical messages and move focus only after cancellation releases disabled manual inputs. Retained textarea values also exposed changing label text; stable explicit reason names keep selectors and assistive output consistent.
- Red regressions proved seven confirmed failures. Final gates: 13 existing plus M1 browser suites, ten M1 cases, nine state/display/evidence unit tests, 90 API unit, 33 financial/all nine goldens and build/startup passed. M1-only checkpoint/rollback and before/after evidence: `docs/m1-handoff.md`. No application DB/prod writes, backend/dependency/financial/style change or Git publication.

## 2026-11-08 - Complete visual v2

- A full visual redesign can retain the accepted state architecture. Shared presentation tokens and existing semantic classes restyle intake, financial review and issuance without creating another form model or changing requests. `main.jsx` adds only presentation and stateless original SVGs; the auth handlers stay unchanged.
- Brand and semantic colors need different jobs. Crimson holds the original mark; ivory actions and independently checked error/pending/success colors keep contrast and written status meaning. Text passes 4.5:1 across every structural surface; input boundaries and focus pass 3:1. Thin layout rules and decorative drafting guides are not control edges.
- Screenshots must distinguish viewport captures from full-page output. Verified 1440x1000 / 390x844 viewports, preserved complete long pages, and captured source focus and modal states separately. Visual QA exposed a mobile column-reverse button order that conflicted with keyboard order; normal column order keeps both consistent.
- Real local session/API/PostgreSQL tests can exercise visual busy/error/reload states deterministically by holding browser requests, without replacing application authentication or printing passwords. Gemini substitution is explicitly confined to test fixtures; no live provider success is claimed.
- Passed ten workflow and three focused browser suites, 90 unit, 33 financial/all nine goldens, 137 disposable PostgreSQL/API, five display/evidence, production build/startup and 35 contrast checks. The 96 screenshots remain local/ignored. No commit, push, merge, deployment, remote font, dependency, backend or database change. Handoff: `docs/visual-v2-handoff.md`.

## 2026-11-08 - Final UI commit gate

- Owner approval to commit is separate from visual approval and remote release. Run the ten existing browser workflows on the final code plus the new version-race/focused UI checks, full unit/costing/PostgreSQL tests, build/startup and syntax checks before staging the approved change set.
- Review an explicit source/docs/test manifest rather than adding the entire worktree. Scan staged content as well as paths; distinguish a documented mocked-provider placeholder from an actual credential. Keep screenshots, review patches, private submission drafts and environment files ignored/local. Preserve all financial goldens and existing backend/package/README content.

## 2026-11-08 - Final selected-version consistency

- A hash-only change within the same RFQ does not remount its workspace. Fetching the new quote alone leaves the RFQ's version list stale if another actor appended that version after the initial RFQ read. The reported Version 1/Version 2 screenshot was a real metadata bug, while all its financial panels correctly belonged to version 2.
- Refresh navigation metadata separately from form initialization: adding the selected version to the original RFQ effect would reset estimator inputs/recovered bodies. Validate the selected snapshot/list together, reject late responses and render saved panels only when the snapshot ID matches the current target.
- Test the actual rendered selector against panel identities. location.hash changes before hashchange is delivered; URL/ready-state assertions are separate from cross-panel render consistency. Deliberately delayed metadata/snapshot/lifecycle replies expose races that immediate local responses conceal.

## 2026-11-08 - Tier 2 review controls

- A matrix should remain a view of form.parts[].rateKeys, not a second assignment model. Six native required selects per part reuse the existing change/review-reset handlers. A 20-part test counts 120 controls and proves deleting a middle part retains the surviving assignments. Wait for catalogue loading before presenting missing-key warnings.
- Verify evidence offset conventions against the real verifier. It uses JavaScript UTF-16 offsets, end exclusive; a prefix containing an emoji, variation selector, accented text and CRLF occupies ten code units. Browser slice matches every genuine returned quote. Invalid/null/unscoped/mismatched ranges do not trigger fuzzy searches or highlights.
- Keep the exact submitted source in transient state and clear stale review/highlights when it changes. The edit-and-reconsent test exposed a wrapping textarea label that included its text value; explicit htmlFor/id association preserves its stable accessible name. Both consent boxes reset and applying verified fields still requires final estimator review.
- A Sales Head summary must read snapshot input/routing/tiers rather than the disabled form's defaults. The browser test distinguishes a saved 1,000-unit baseline from the RFQ's 180,000-unit facts while retaining direct server-side write denial.
- Opening a confirmation is not business intent to issue: do not allocate a recovery key or POST until Confirm. React busy state alone cannot prevent two events in the same batch; a synchronous ref gate prevents a second fresh request. Existing same-key recovery remains independent of the modal.
- Native dialog modality makes background content inert, but explicit forward/reverse button wrapping was needed for the strict keyboard test. Cancel/Escape restore focus; navigation discards only the unopened issuance intent. Server eligibility/approval remains authoritative.
- Independent browser gates precede each next slice. Expanded regression tests found duplicate-confirm, focus-wrap and source-label problems; fix these without weakening financial, consent, recovery or identity assertions. Proportional charts remain deferred.

## 2026-11-08 - Owner-requested Tier 1 visual refinement

- Passing workflow tests does not mean the owner has accepted a visual design. Preserve the first screenshot set and distinguish approved implementation scope/palette from visual approval in the handoff.
- A structured pending table can use only the existing snapshot reference/customer, version and saved baseline. Do not invent submission dates or join every lifecycle merely to enrich presentation.
- Remove duplicated state by keeping RFQ status/assignment in one title block while preserving outcome decisions, recovery, errors and terminal history. Relocate the existing form/components without reconstructing their request state.
- Decimal precision and display length are separate concerns: strip only trailing fractional zeros with string operations for rates; expose the exact original value in history; retain monetary paise and every significant digit. Large-value, zero and six-place tests guard this boundary.
- A scroll hint should correspond to actual overflow and remaining direction. ResizeObserver plus a labelled focusable region allows keyboard navigation; sticky mobile RFQ references preserve row context. Put the rate value next to its key before secondary columns on mobile.
- New sidebar links replace redundant catalogue/register links; tests follow the intentional accessible navigation change while keeping all workflow and golden assertions. Existing consent, unknown-save replay and server authorization remain unchanged.

## 2026-11-08 - Tier 1 visual redesign

- Keep display formatting separate from authority: insert Indian separators into decimal strings, preserve every fractional digit and derive the headline only from the selected saved snapshot. Date-only inputs need an explicit Kolkata midnight so a timezone conversion cannot change their day.
- RFQ outcome and quotation lifecycle describe different facts. The register response cannot support a lifecycle badge; the existing version-scoped lifecycle response can. Do not invent a combined status or fetch every snapshot merely for decoration.
- Relocating a workflow component can accidentally remove it entirely. Browser approval/PDF coverage caught the missing lifecycle panel; restore the same component and recovery logic rather than recreating it. Intentionally shortened identifiers still need keyboard access to full exact values; existing identity assertions must exercise that disclosure, not disappear.
- A disabled costing form may show RFQ defaults rather than selected historical inputs. Explicitly label the Sales Head defaults and direct review to saved results/internal PDF to avoid implying unsaved values are authoritative.
- Hairlines suitable for panels are insufficient control boundaries. The tertiary token passes contrast against every dark surface and is used for inputs; copper focus and dark-on-copper action text are independently checked. Written labels accompany settled/error colors.
- Opening the catalogue from the shared shell during intake must preserve the original tab and form, just like the previous contextual link. The new focused browser test verifies a real popup and the unchanged unsaved field after it closes.
- All ten existing workflow suites, financial/API/unit checks and focused UI checks passed locally. The 1440/390px screenshots verify the tested fallback rupee glyph. Chrome-only targeted checks do not establish full WCAG/screen-reader or cross-browser compliance. No Tier 2, cloud, commit or deployment work.

## 2026-11-03 / T02.2 Gemini extraction and review

- Gemini proposes raw facts/evidence; it cannot calculate costs or choose internal keys. Structured JSON is still untrusted: one strict Zod schema feeds provider JSON Schema and application validation, with unknown fields rejected.
- Verbatim quotation is necessary but insufficient. Independently check field label/value, complete numeric token, section/part identity, unit, contradictions and exact conversion. decimal.js converts 610 g to 0.61 kg and 192 seconds to 3.2 minutes exactly; 1 second in minutes exceeds six-place exactness and must not silently round. Setup must explicitly say per batch.
- A conservative verifier should say unsupported/ambiguous when it cannot prove a mapping. Raw prose, date/unit ambiguity and wrong-part quotes stay visible for manual resolution. Known revision language blocks automatic copying; broader semantics/injection still require estimator judgement.
- Disable SDK retries (attempts includes original request) and automatic continuation before adding one application-controlled transient retry within a total deadline. Abort limits client waiting, not guaranteed provider-side work. Extracting again can consume quota; only existing confirmed RFQ saves have durable idempotency receipts.
- Missing key/provider errors must not break manual intake. Source/consent/review are temporary browser state; only explicitly accepted/corrected business fields enter T02.1 persistence. No evidence/source table or second save service is needed for this slice.
- Actual checks: 61 unit/config/costing, 75 reported PostgreSQL results, all four Chrome suites, 37 syntax checks, build and production startup passed. AI provider and SDK transport are mocked in these tests; human corrections and real DB save/replay were verified. Genuine-test command: LIVE PROVIDER TEST NOT RUN because no AI_API_KEY exists. Do not claim actual provider connectivity.
- Provider terms/data policy and limitations: ADR-0009. Exact files/results/setup: docs/t02-2-handoff.md. No billing, deployment, migrations or later features. STOP before T02.3.
- Owner questions: Why is exact evidence alone insufficient? Why do verified proposals still need manual keys/confirmation? Why do mock tests not prove access, and how do extraction retries differ from save idempotency?

## 2026-11-03 / T02.1 manual RFQ intake

- Manual RFQ intake separates business facts and real key selection from quotation-time rate resolution. No pricing logic belongs in intake; selecting a key does not prove historical rate availability.
- Atomic means header, every part/route and retry receipt all commit or all roll back. A second-part route failure must leave no partial RFQ. One client/transaction and actor-key advisory lock enforce the service path; UNIQUE constraints remain final guards.
- A failed response can follow successful COMMIT. Persist exact key/body before POST; lock inputs after uncertainty and retry the same intent. A fingerprint detects changed content; corrected confirmed-invalid requests reuse the uncommitted key. A new key is intentional new work, not error recovery.
- Restricted INSERT columns permit creation without RFQ/master UPDATE, history mutation, status override or forged timestamps. Runtime credentials remain trusted for complete assembly/receipt correspondence; ordinary SQL grants do not implement user-role authorization or remove existing owner powers.
- Real PostgreSQL and Chrome exercised rollback, six concurrent retries, lost acknowledgement/response, refresh recovery and original single-part cost 119.76/price 149.70. All nine independent goldens remain unchanged. Exact commands, results and bounds: docs/t02-1-handoff.md and ADR-0008.
- Owner questions: Why must receipts and all RFQ rows share a transaction? Why retry the original key/body after uncertainty? Why resolve values by quotation date rather than invent rates during intake?
- No provider calls/dependencies/keys, cloud/deployment or later scope. STOP for T02.2 approval.

## 2026-11-03 / T01 post-audit correction and verification

- Error middleware must test headersSent before setting Cache-Control or writing a response. Once headers are sent, delegate the identical original error to Express. The focused regression failed on the old code and passed after the two-line reorder; it asserts no header/status/body write and exactly one delegation.
- Browser authentication previously used development sessions. Both suites now call browserTestDatabase, which forces a newly created local database regardless of caller options, generated users and a restricted runtime role. Existing databases are only used as administrative connections for generated fixture creation/removal; no browser data, migration or seed writes go there. Setup checks the actual generated database name before schema writes. Cleanup tracks created resources. Three negative target probes and both real Chrome suites passed; no browser databases/workflow roles remained.
- Full results: unit/config/costing/TLS 46/46; PostgreSQL 50/50 including 5 parent tests; production-server smoke 1/1; both browser scripts exited 0; 30 API and 3 browser/helper syntax checks passed; fresh frontend build passed. Build and npm audit each needed an approved retry after sandbox access/network restrictions. No application fallback or unrelated dependency fix was introduced.
- Historical snapshots and concurrency remain tested against real PostgreSQL: first versions 1/2, existing-header versions 2/3, and six identical HTTP submissions yielding one version. Ownership/ACL and public-table data digests for existing dev/test databases matched before/after the complete run.
- Bounded tracked/reachable-history secret scan found no matches; npm audit reported zero known vulnerabilities. Neither establishes the absence of all possible security defects. Local runtime ownership remains an operational deployment blocker if those credentials are used; fresh cloud isolation and public HTTPS/browser behavior still require execution.
- Original-brief provenance is separate from implementation verification. Requirements documentation now flags direct source comparison UNVERIFIED without changing accepted financial policies. No migration, formula, golden, ADR-policy, endpoint or deployment change.
- Owner questions: (1) Why must an already-started response delegate its original error before setting any header? (2) How do generated browser databases and before/after digests demonstrate development-data isolation? (3) Why do passing local tests and a zero-result dependency scan still leave cloud credential/TLS/proxy verification necessary?

For each completed slice:

## YYYY-MM-DD / Txx

- **I can explain it without looking at the code:**
- **Input → API → business logic → database → output:**
- **Why we chose this design instead of an alternative:**
- **One failed test or mistake, and how we fixed it:**
- **Failure mode I can demonstrate:**
- **Interview question I can answer:**

Before T01, explain in your own words: RFQ vs quote; why gross margin differs from markup; why rates need effective dates; what makes a quote snapshot auditable.

## 2026-11-02 / T01 milestone 1

- Stack accepted; formulas and golden numbers unchanged.
- Rate end derives from next start; no historical row edit. Explicit expiry gaps unsupported.
- Owner practice: why can a backdated insert change a new calculation but not a saved snapshot? Why must authentication precede public writes?

## 2026-11-02 / T01 milestone 2

- React uses relative `/api` URLs; Vite proxies locally, Express serves built assets in production. Same-origin avoids cross-origin session configuration later.
- `pg` preserves NUMERIC/BIGINT as strings. Configuration errors fail startup without exposing credentials.
- Executed: 3 config/API tests passed; Vite build passed after sandbox escalation. No write endpoint exists.

## 2026-11-02 / T01 milestone 3

- RFQ has many parts; part references typed rate keys and has append-only route revisions. Rate starts are unique; SQL lead derives ends. Trigger tests reject historical UPDATE/DELETE/TRUNCATE, including when run by the local table owner (trusted owners can still alter DDL).
- One transaction wraps each migration/seed. Migration checksums reject changed applied SQL; seed verifies fixture content and rolls back on drift. No calculation output is seeded.
- Executed against PostgreSQL 17.11: 9 database subtests and parent passed; fresh/repeated migration and seed passed. Same-origin HTML/JS and real database readiness smoke passed. Financial goldens await milestone 5.
- Owner questions: (1) Which rate applies exactly on the next start? (2) Why store a chosen rate's ID and value in a quote? (3) Why can database readiness pass while quote creation is still unavailable?

### Local role verification

The owner changed database ownership and configured forgequote_app credentials in ignored .env. PostgreSQL database ownership did not change postgres-owned table permissions. Granted only SELECT/INSERT on existing checkpoint tables and SELECT on the derived-period view. Repeated migration/seed, all tests and real readiness passed with the new connection. No historical rows were updated. Future ALTER operations on postgres-owned objects still require their maintenance owner; production runtime credentials must remain separate from maintenance/database ownership.

## 2026-11-02 / T01 milestone 4

- Password -> salted asynchronous scrypt comparison -> regenerate opaque session ID -> save user ID, expiry and CSRF in PostgreSQL. Browser gets an HTTP-only cookie; no password or role is trusted from that cookie.
- CSRF token proves the request came from a page able to read the session response; exact Origin is checked too. Authentication answers who; role authorization answers which actions are allowed.
- Database/session errors fail visibly; role and activation are reloaded for every authenticated request. Absolute expiry is enforced even if a browser still sends an old cookie.
- Tests executed: 5 unit/config/API tests; 19 real PostgreSQL subtests plus 2 parents (21 reported); production build; real Chrome wrong-password/both-role login/reload/logout/mobile smoke. Cookie/proxy tests simulate trusted HTTPS headers; public deployment remains unverified.
- Found and fixed Vite reading server NODE_ENV=development during a production build; now only proxy-port settings are read without mutating Vite's environment.
- Owner questions: Why regenerate the session ID after login? Why does an HTTP-only cookie still need CSRF protection? Why does disabling a user invalidate access without waiting eight hours?

### Milestone 4 follow-up: maintenance and runtime separation

- Owner requested separate maintenance credentials and no ownership changes. CLIs now reject absent/same-role/different-target maintenance URLs; existing development migrations validated as a no-op. Explicit table-specific grants give runtime SELECT except session CRUD. Historical trigger protections remain intact.
- Removed the draft-route placeholder. Only a test-only middleware probe exercises estimator permissions; no quote-write authorization claim.
- Existing users/sessions from 40f26fe remain forgequote_app-owned. ACL revocation removes ordinary DML permissions but cannot remove an owner's DDL/self-grant powers. Full isolation requires an additional owner-authorized provisioning decision, so do not present this development account as deployment-ready.
- Owner questions: Why does database ownership differ from table ownership? Why must session storage have DELETE permission? Why can revoked ordinary grants fail to fully restrict a table owner?

## 2026-11-02 / T01 milestone 5

- Inputs/resolved rate values -> pure decimal.js calculator -> three annual quantity scenarios, seven rounded lines, margin price, separate GST totals and stable formula version. No database, HTTP, clock or environment dependency; no input mutation.
- Financial ordering matters: scrap/overhead use rounded material/machining, setup expense is not rounded before allocation, total cost sums rounded lines, and gross margin divides by (1-margin). Form the exact machining numerator before division to avoid an unnecessary recurring intermediate at a rounding tie.
- Defaults round 50/100/150% quantities HALF_UP, minimum one. Batches=min(12, annual quantity); below twelve each batch has one unit. The first remainder batches get an extra unit. Baseline must equal requested quantity in the new input, not mutate RFQ facts.
- Independent expectations: literal transcription of all nine approved golden cases, full three-part baseline breakdowns and annual values. Additional hand-auditable checks include 0.06 subtotal at 18% GST -> 0.01 tax (not summed part taxes), 1.01 / (1-60%) -> 2.53, and setup 0.005*12/24 -> 0.00 without intermediate rounding.
- Executed: 33 costing tests passed; npm test 39 passed; real PostgreSQL/auth tests 21 reported passed (19 subtests + 2 parents); permission checker passed and still reports known owner DDL powers. No frontend change/build rerun; no integration of calculator with quote persistence.
- Owner questions: Why do rounded component sums differ from rounding raw totals? Why is 20% margin a division by 0.8? Why must multi-part GST round only after aggregating the quotation subtotal?

## 2026-11-02 / T01 milestone 6

- User-authorized persistence only. Internal server actor ID -> current DB role/activation check -> RFQ header insert/locked counter increment -> one MVCC statement resolving all master inputs/rates -> unchanged engine -> normalized snapshot inserts -> one commit/receipt. There is no HTTP or React integration.
- An atomic header UPDATE serializes version allocation without max(version)+1 races. A failed transaction restores both first-header insertion/counter and all snapshot rows. Concurrent existing drafts saved 2/3 (next=4); simultaneous first drafts saved 1/2 (one header, next=3).
- UPDATE/DELETE guards alone miss late INSERT. A database-generated xid8 creation transaction plus child-insert guard closes assembly at commit, without deferred sealing triggers or a sealing UPDATE. Runtime cannot supply that xid or creation time. Completeness remains the service's responsibility; compromised direct SQL can fabricate new history. ADR-0005 explains this boundary.
- Raw NUMERIC(18,6) matches the approved engine inputs, but calculated prices/annual totals can be far larger. Unconstrained NUMERIC plus finite/nonnegative/exact-paise domain checks prevents silent storage rounding/narrowing. JSON financial values are explicitly strings. Manufacturing formulas remain only in decimal.js.
- Immutable version copies retain master labels, inputs, selected rate IDs/values, routing IDs/inputs, formula, date/GST, batch plans and all financial outputs. Retrieval never consults current masters or calculates. Diagnostic reproduction dispatches the saved formula version; future changes must retain old implementations.
- Lost COMMIT acknowledgement does not imply rollback. Injected post-commit failure surfaced once while exactly one version existed. No retries were added. Future HTTP must transactionally bind a unique actor/submission key and request fingerprint to its receipt; replay/reconcile with the same key. See ADR-0005.
- Executed: npm.cmd test 39/39 passed; npm.cmd run test:db 33/33 reported passed; local migration 003, repeat no-op, explicit runtime grants and permission checker passed. Persisted all nine unchanged goldens, three-part totals, master/config history, large exact values, rollback and restricted-role service writes. Tests now use TRUNCATE CASCADE to reach the immutability trigger despite newly added reference constraints. Frontend/public deployment untested in this milestone.
- Existing runtime auth-table/database ownership remains unchanged and blocks public isolation; new snapshot tables are maintenance-owned. No ownership or applied migration was changed. STOP before Milestone 7.
- Owner questions: Why does the locked counter prevent both first-draft and later-version races? Why must saved inputs and resolved rates survive master changes? How does a submission key handle a successful COMMIT whose acknowledgement was lost?

## 2026-11-02 / T01 milestone 7

- The HTTP adapter does authentication/role/CSRF/Origin checks and strict business-field validation; financial calculation remains in the accepted engine. GET responses expose saved data and decimal strings. The browser formats strings only; it never computes authoritative prices or GST.
- A request failure is not proof that COMMIT failed. Draft submission keys are scoped by authenticated actor, protected by UNIQUE(actor_user_id, submission_key), and tied to a canonical business fingerprint. Fixed field ordering, lowercase UUIDs and stripped margin fractional zeros make equivalent valid requests replay consistently; CSRF/cookies are separate transient security data.
- Idempotency lookup, header allocation/snapshot creation and receipt insertion must use one transaction/client. Refactoring createDraftVersion to accept an internal shared client avoids nested transactions. A transaction-scoped advisory actor/key lock serializes simultaneous retries; committed replay returns before reading current masters. The database unique constraint remains a final duplicate guard.
- Store the exact pending browser key/body before POST. After a lost response, retry the same payload/key; only an intentional new calculation gets a new key. sessionStorage survives tab refresh and login expiry, but not tab closure/deletion. Storage errors block saving; malformed saved records are rejected. The URL independently retains saved version selection.
- Observed: six concurrent HTTP retries -> one 201, five 200, one version. Receipt insertion failure rolled back counters/children/keys. Simulated lost COMMIT acknowledgement and a real browser POST whose response was aborted both recovered without duplicates. Backend child process restart retained session and historical quote. A live RFQ weight change did not reprice saved UI results.
- Actual results: 39/39 unit/config/API tests, 33/33 standalone costing, 44/44 reported PostgreSQL tests, production build, legacy auth Chrome smoke and quotation Chrome smoke passed. Spindle baseline 119.76 cost / 149.70 price and all three scenarios came from saved GET. Empty/invalid/missing-rate/expired/read-only/network recovery states exercised; desktop/mobile screenshots visually inspected. esbuild required execution outside sandbox parent-traversal restrictions; no final failing test.
- Migration 004 and explicit runtime-grants command applied locally; repeat migration no-op and permission checker passed. Existing ownership/security blocker preserved; no deployment. See ADR-0006 and milestone-7-handoff.md. STOP before Milestone 8.
- Owner questions: Why must receipt and quotation share one transaction? How do a canonical fingerprint and retained key distinguish replay from changed intent? Why must the UI display stored results while the server enforces roles and historical rates?

## 2026-11-02 / T01 milestone 8 preparation

- Owner modified the reviewed plan: keep existing local ownership unchanged; prepare fresh synthetic Neon Free data and one Render Free Express/React service. No cloud access/resources/deploy/purchase yet. A scoped setup procedure is safer than broad ownership repair on a cluster shared with unrelated databases.
- Runtime must be a SQL-created non-owner LOGIN with no elevated memberships. Merely SET ROLE to a restricted role can hide a privileged session_user; strict cloud checks now require direct authentication too. Tests used real separate random LOGIN credentials in a new disposable database and proved escalation/DDL/trigger/history denials. Cleanup tracks only resources actually created.
- Database/schema ownership grants DDL powers that ordinary REVOKE statements cannot remove. The legacy checker still reports the intentionally retained local limitation. The fresh-cloud checker additionally checks DB/schema ownership, CREATE/TEMP/TRIGGER/REFERENCES and exact column ACLs, functions/domain and all 25 enabled triggers. Missing-trigger and privileged-login impersonation counterexamples were rejected.
- TLS encryption alone is insufficient: pg URL SSL options can overwrite explicit settings. Normalize/remove those flags, reject downgrade modes and enforce certificate/hostname verification with TLS 1.2+. Actual pg transport accepted a trusted test peer and rejected untrusted/wrong-host/plaintext peers; no global certificate bypass. Test keys were generated/deleted locally; no live Neon certificate claim.
- Liveness asks whether Node responds; readiness asks whether the DB/schema is available. Frequent DB probes could consume Neon Free compute continuously. Render points at a DB-free route before sessions; release diagnostics use readiness separately. Session pruning still costs some compute while running.
- Production logs use a small allowlist instead of serializing request/error objects. Malformed/oversize request tests confirmed no passwords/cookies/tokens/documents/raw SQL/path/query leakage. Quote limiting is 30 attempts per actor/15 minutes in one process; blocked retries keep their key and do not create another quote.
- Node pinned/tested 24.20.0. Production skips repository .env and refuses maintenance/test/seed secrets. Build command includes dev dependencies for Vite; runtime serves built assets, with no runtime migration/seed. Render file declares only Free web, manual deploys and no database/paid resources.
- Actual checks: 45 unit/config/API, 50 reported PostgreSQL, 33 costing, frontend build, 30 API syntax checks, 1 actual production-server start, both actual Chrome suites and final 5-test fresh-cloud rerun passed. Fresh setup/CLI checks and seeds repeated without reset. Existing dev/test ownership and public ACL/relation-owner snapshots unchanged. No applied migration or costing/golden change.
- Remaining manual gates: account access/explicit action approval, free-project/region validation, actual Neon TLS/roles, Render origin/proxy/cookies/public browser smoke and evaluation retention/quota checks. Historical cross-cluster restore remains unverified; this milestone uses fresh fixtures. STOP here; no later features.
- Owner questions: Why does local grants success not imply ownership isolation? How can TLS URL options or SET ROLE hide an unsafe deployment configuration? Why should health probes and rate-limited/uncertain saves preserve free-tier capacity and original submission intent?

## 2026-11-03 / T02.2 live Gemini correction

- Model discovery and minimal inference with the existing key succeeded; the extraction failure was HTTP 400 INVALID_ARGUMENT. Mapping every 400 to model unavailable concealed a request-schema failure.
- Removing only provider-facing parts.maxItems resolved the rejection. Zod remains the authoritative 20-part validator; provider constraints cannot replace server validation. Exact schema-difference and SDK transport tests preserve all other provider constraints, and a 21-part provider response is still rejected.
- Controlled request/schema, billing and precondition codes supplement existing model/access/quota codes. Raw SDK error JSON is private; HTTP tests verify no source/secrets/provider responses reach public responses/logs and no new retry/write occurs.
- Actual checks: 63/63 unit/config/costing, 75/75 reported PostgreSQL, 37 API module syntax checks. All nine external financial goldens and persisted snapshot expectations are unchanged. Checked-in npm.cmd run test:ai:live PASSED using unchanged model/existing key and complete server validation on synthetic text. No live integration claim relies on a mock or diagnostic override.
- No formula, migration, ownership, RFQ save behavior, billing, credential, provider/model or deployment change. Limits remain literal evidence validation, estimator review, bounded output/deadline, transient-only retries, synthetic-only data and project quota. STOP before T02.3.
- Owner checks: Where is max(20) still enforced? Why is provider 400 a different problem from 404 or 429? Why does live fixture success not establish general extraction accuracy?

- Chrome: AI review/manual fallback, authentication, quotation and manual RFQ suites all exited 0. The first manual RFQ run failed its immediate field-enabled assertion at tests/browser-rfq.smoke.js:27 during concurrent browser runs; the isolated rerun passed without code changes. Root cause of that timing-sensitive failure was not established. Browser provider calls were mocked and disposable local PostgreSQL fixtures were cleaned up.

## 2026-11-03 / T02.3 deterministic Excel import

- Stored XML numeric tokens stay strings through validation/normalization; Number is only used for bounded workbook indexes. This avoids introducing floating-point corruption but cannot restore information Excel already discarded. General numeric styles and literal units/headers prevent display-format reinterpretation.
- OOXML relationships, shared strings and explicit coordinates matter: sheet1.xml, contiguous rows and numeric-looking identifiers cannot be assumed. Formula caches never establish trusted required values; any invalid record rejects the import. Source cells are review evidence, not authority.
- Worker/deadline/heap limits plus actual decompression/checksum and XML bounds complement the small binary upload limit. Authentication/role/Origin/CSRF/type/attestation precede buffering. No extraction to disk, provider invocation or business write. Controlled failures keep manual intake available.
- Real Chrome verified explicit apply, preserved header, manual keys, correction/confirmation reset and lost-response same-key recovery using the unchanged transaction. All five browser suites passed; new API tests use a new disposable database. Final suites: 70 unit/config/costing, 80 reported PostgreSQL, 40 syntax modules, production build and 1 actual startup passed; nine goldens unchanged. Sandbox Vite access denial resolved by authorized normal-access build. Audit found zero known vulnerabilities.
- Read-only PDF assessment found a Node-compatible PDF.js version and reusable Gemini/text-evidence boundary, but package size/optional native canvas and layout/page mapping add work. No PDF package or code installed; recommend defer pending approval. RFQ PDF intake does not replace final quotation PDF generation.
- Owner checks: Which numbers may use Number and which must remain strings? Why reject a formula with a cached value? Why can import/review be retried without the same persistence concerns as an uncertain RFQ save?

## 2026-11-03 / T02.3 shutdown recovery

- Recovery verified branch/HEAD/diff/untracked files rather than treating earlier test reports as evidence. All 23 intended files survived at fad3d79 without a final commit. No application implementation needed to be repeated.
- Fresh checks: 70/70 unit/config/costing; 80/80 reported PostgreSQL including security/permissions; all five browser suites; 40 syntax modules; production build and 1 startup; audit zero known vulnerabilities. Initial Excel browser test failed because APIRequestContext had no baseURL; a test-only absolute URL correction made the example-download check and complete sequential browser run pass. Nine financial goldens were unchanged. Existing standard synthetic live Gemini test passed separately; Excel still made zero provider calls.
- Owner-reported manual QA: a synthetic two-part RFQ containing SP-101 and BR-202 produced four suggested parts with unsupported associations. This is an unresolved T02.2 Gemini finding, separate from deterministic Excel import. The complete source/request and a captured response were not provided for reproduction in this recovery run. No Gemini correction or model/prompt/evidence change was made. Passing the standard live fixture does not resolve this case; require separate approval to investigate/fix it.
- No existing development DB reset/modification, no finance/history/migration/save-service change, PDF implementation, deployment or push. STOP after focused Excel commit and handoff.

## 2026-11-03 / T02 numbered part association correction

- The model returned two proposals. Our verifier created four results by retaining unknown numbered anchors and appending two source placeholders. React then correctly mapped the flawed response to four blank form parts; money/unit conversion was not the root cause.
- Component boundaries and identifier fields are different concepts. Explicit numbered/legacy headings now bound evidence scopes, while their Part Number fields stay metadata. Source sections own cardinality and order; matching is exact or requires independently verified complete identifier evidence. Unknown proposals warn; ambiguous/duplicate matches select no winner. No general fuzzy matching or weakening of literal quote/value checks.
- Tests first: seven of eight new regressions failed before the fix; legacy case passed. Final suites: 78/78 unit/config/costing including nine unchanged goldens; 81/81 reported PostgreSQL; six standard real Chrome suites plus separate real Gemini/Chrome workflow; two real SDK fixtures; 40 syntax modules; production build and 1 startup. Existing manual RFQ immediate field-enabled assertion failed once while browser runs overlapped; isolated rerun passed without edits. That timing-sensitive test remains a limitation.
- Live proof includes exact original part block, correct 0.61/1.25 kg conversion and two ordered normalized components. Real-provider Chrome verifies deliberate apply populates two form parts; cycle/setup/keys remain manual, and explicit completion/confirmation saves two synthetic parts in a disposable database. Extra unknown model proposal was separately shown as a warning only in mocked HTTP/Chrome regressions.
- No model/provider schema, Excel code, costing policies/formulas, migrations/history/save service, ownership/grants or dependency changes. No key/provider response logging, deployment or push. Remaining limits are the documented heading grammar, literal evidence/units and provider/project availability; estimator review remains necessary.
- Owner checks: Why must source sections own component count instead of Gemini proposals? Why can a repeated value be verified in separate bounded sections but not borrowed across them? Why do duplicate identifiers/proposals require manual review instead of deduplication?

## 2026-11-03 / Approved stabilization before T03

- Independent asynchronous requests need independent UI readiness gates: the manual RFQ smoke now waits for the actual enabled field rather than inferring rate readiness from AI status. Three consecutive runs passed with all behavioral assertions retained.
- Page-level overflow is insufficient for long evidence. A maximum-length unbroken identifier/description regression failed at 390px before responsive evidence cards/wrapping, then passed at 320/390/1280px after the CSS fix.
- Local forgequote_dev migration 005 and reviewed grants applied with separated maintenance/runtime identities and verified checksums. Readiness/login passed, but actual create failed 503 / SQLSTATE 42501 on users. Runtime owns users but lacks UPDATE; read-only FOR KEY SHARE EXPLAIN also fails. Foreign-key execution must be verified beyond ordinary grant checks. Stopped without changing ownership or broadening privileges; no partial records, existing non-session rows/owners preserved. Separate approval is needed for the permission correction.
- Fresh unit 78/78, costing 33/33, PostgreSQL 81/81, all six browser suites (manual RFQ three times), 40 API syntax modules, changed browser syntax, build and production startup passed. Nine financial goldens unchanged; generated test databases removed. No T03 feature, migration source, financial formula, dependency, deployment or push change. Details/questions: docs/stabilization-handoff.md.

## 2026-11-03 / Development RFQ FK permission correction

- SQLSTATE 42501 came from the final receipt INSERT's internal users FK FOR KEY SHARE check, not an unnecessary application lock. The check runs as referenced-table owner; maintenance-owned fixtures passed while preserved runtime-owned development users had self-revoked UPDATE. Tracing the exact failing statement and actual role/ACL avoided an unnecessary query change.
- Existing maintenance grant tooling conditionally restores only users UPDATE(id) when runtime owns users; exact checker and full HTTP regression now cover both ownership layouts. No auth-field UPDATE, users DELETE, table-wide UPDATE, ownership transfer or maintenance fallback. The ACL genuinely allows direct SQL ID changes; ADR-0011 records this local exception and the retained owner-power deployment limitation.
- New runtime-owned regression reproduced 503 before the fix; focused suite 26/26 afterward. Fresh full results: 78 unit/config/costing, 33 dedicated costing, 94 PostgreSQL, all six Chrome suites, 40 syntax modules, production startup 1/1 and build passed (sandbox Vite denial resolved by normal-access rerun). Nine financial goldens unchanged; disposable fixtures removed.
- Verified local forgequote_dev target and separated actual identities, applied corrected reviewed grants, and confirmed real 201 create/200 reopen with two parts/200 original-key retry/409 changed payload/401 anonymous/403 sales head. All existing non-session data and ownership preserved; one synthetic verification RFQ remains. No other existing database, migration source, financial formula, rate, snapshot, deployment or T03 feature change. Handoff: docs/dev-rfq-permission-handoff.md; STOP.

## 2026-11-03 / T03 complete multipart quotation integration

- Recovery verified exactly three interrupted backend edits at d29d2b5 and preserved their correct implementation; no reset/rewrite or new approval cycle. The internal quotation engine/service already supported complete multipart snapshots. Removing the HTTP gate and extending request/UI contracts was sufficient; no engine or migration change.
- Canonical order and presentation order are different: normalize UUIDs, reject duplicates and sort new part entries before hashing, then resolve exact RFQ membership/routes by IDs. The existing one-part canonical bytes/fingerprint remain frozen. React maps controls by IDs and preserves old flat pending bodies exactly through refresh/retry.
- Each part is calculated separately using unchanged decimal policies; quotation GST applies to the combined taxable subtotal. Expose saved annualValueExGst for future approval, without introducing approval behavior or browser arithmetic.
- Passed 78 unit/config/costing, 33 dedicated costing, 104 PostgreSQL, all six Chrome suites, 40 API syntax modules, changed test/helper syntax, build and production startup 1/1. Nine goldens unchanged. New two/three-part HTTP and browser workflows cover complete persistence, totals, ID order, concurrency/rollback/auth/recovery and snapshots. Initial size-fixture and obsolete browser-rejection expectations were corrected after observed test failures.
- Disposable fixtures/test parent removed; no existing development/test data, ownership or grants changed. No dependency, approval/PDF, deployment or push. Contract ADR-0012 and docs/t03-handoff.md record manifest, limits and three owner questions; STOP after T03 commit.

## 2026-11-03 / T07 local deployment configuration completion

- Preserved the six interrupted deployment edits on feature/T07-cloud-deployment. main, pinned Node, explicit 0.0.0.0/PORT, real liveness and one-origin React/API remain coherent. The approved neondb name requires an exact confirmed direct Neon host; this does not relax any strict ownership/role/ACL checker rule.
- Latest owner instruction prohibited further cloud access. Completed Neon provisioning was not repeated or reverified remotely. No Render/Neon session, database connection, provider request, push, merge or deployment was performed on resume.
- Completed regression evidence: 78 unit/config/costing, 33 dedicated costing, 104 PostgreSQL, all six Chrome suites, 40 API syntax modules and production startup 1/1; disposable fixtures/parent removed. Final local build, unit 78/78, syntax/startup rerun passed; nine financial goldens unchanged.
- Temporary credential handoffs/helpers were removed, preserving the sole unexposed runtime/demo/session handoff in ignored Windows-DPAPI .env.cloud-secrets.dpapi without a maintenance URL. Session-memory credentials/cached dashboard states cleared. Prior owner exposure cannot be undone by local cleanup; private reset confirmation remains outside this no-cloud task. Handoff: docs/t07-handoff.md. STOP after local commit.


## 2026-11-04 - T04 approval and controlled issuance

- Stored immutable financial facts and append-only lifecycle decisions serve different purposes. Leave the snapshot untouched; derive status from its events, and mark stale history separately.
- Reuse the existing version allocator header lock. A separate event-only lock would serialize decisions but miss a concurrent new costing version. Row locking plus unique event/decision/key/number constraints give independent protections.
- Exactly INR 25,00,000 is below-or-equal clearance; one paisa above requires Sales Head. Test both using explicit stored numeric strings, not engine-generated expectations. A real low-volume spindle fixture independently expects INR 3,01,850.00.
- Replay an already committed receipt before current-state/stale checks; replay is recovery of history, not permission to repeat a transition. Persist exact action/body/key before browser POST. Chrome deliberately loses a successful issuance response and recovers across refresh with one issued event.
- PostgreSQL CHECK accepts unknown/NULL: explicit IS NOT NULL and COALESCE(...,false) prevent missing reasons/numbers and NULL transition conditions bypassing guards. Initial local migration CASE parsing and test-only user-role-constraint errors were corrected; no applied migration was edited. Existing local user identity contract was preserved by testing deactivation instead.
- Local disposable integration and browser checks only. No Neon/Render changes. Complete manifest/results/owner questions: docs/t04-handoff.md.


## 2026-11-05 - T05 customer quotation PDF

- A customer projection must be an allowlist. Passing the full internal snapshot to a template risks leaking costs/margins/rate IDs through metadata or future layout changes even if the visible table seems correct. The renderer only receives customer identifiers, issued provenance and saved selling totals.
- Reuse immutable snapshot/lifecycle readers inside one shared-client transaction, locking the same header used by version creation. This avoids a stale eligibility check followed by a final download for a newer current state. PDF reads never create lifecycle events; old issued history stays intact when a stale download is denied.
- Monetary strings can be grouped/formatted without any arithmetic or Number conversion. PDF unit/line/quotation/GST values come straight from stored scenarios, including very large exact paise strings. No live customer/rate/configuration changes alter an issued document's bytes while it remains eligible.
- Real font metrics and independent text geometry checks are more reliable than fixed row heights. Keep the first row with the scenario header, and place page footers outside body flow. Unit tests exercise 20 long components, very large decimals, wrapping and all three scenarios across 32 pages.
- Embedding a Unicode font does not imply every script is supported. Bundle unmodified licensed Noto Sans files with OFL/source/hashes, verify rupee extraction/appearance, and visibly reject uncovered glyphs rather than silently outputting missing-glyph boxes. Fontkit is already used by PDFKit; making it a direct pinned dependency documents our coverage-check API.
- PDF.js independently verifies text/fonts/attachments/geometry; PDFium raster QA resolved misleading missing repeated-header glyphs in the initial PDF.js/native-canvas rendering pass. Neither test tool is a production runtime dependency. Handoff and owner questions: docs/t05-handoff.md. No cloud migration/deployment/push/merge.


## 2026-11-05 - T06 rate catalogue and essential intake UX

- A request for rate management does not itself assign a rate-writer role. Existing accepted runtime grants are SELECT-only; the owner's conditional boundary permits a useful read-only catalogue while explicitly recording the missing writer/validation/audit/backdating policy. Deny writes on the server and keep strict cloud permissions intact.
- Existing unique effective starts and derived next-start ends already prevent overlapping intervals. Display start-inclusive/end-exclusive periods directly from the view, preserve NUMERIC as text before JSON aggregation, and distinguish missing current history from a real zero rate.
- A sole available key is a suggestion, not financial approval. Explicit apply actions use real IDs, leave ambiguous categories empty, preserve already selected keys, and clear the final human confirmation. Common-key copying is explicit about replacement and reuses unchanged server category validation/idempotency.
- Collapsible evidence can reduce form size without weakening verification: preserve raw values, quotes/offsets and worksheet/cell references; test the collapsed default and deliberately expand details before checking evidence. Component focus targets plus Tab are easier to verify than scroll-only controls.
- History navigation from an unsaved form must not discard edits; open it separately and test that the original fields survive. Focused Chrome tests cover the complete two-part copy/confirm/save path, correct persisted IDs/quantities and 320/390px layouts.
- Initial focused tests exposed a selector without an explicit accessible label and a test expecting the immutability trigger before PostgreSQL's FK TRUNCATE guard. Added the select label and used disposable-only TRUNCATE ... CASCADE to exercise the existing trigger. Final gates/limits/three owner questions: docs/t06-handoff.md. No cloud action or C1 audit.


## 2026-11-05 - Resumed final requirements

- Recover the whole diff before resuming: the interrupted work included API/grants/UI beyond the reported three files. Preserving it exposed a JSX boundary error, a button in the wrong component and a role middleware called with an unsupported array. Focused end-to-end checks caught all three.
- NUMERIC(18,6) coerces before ordinary row checks; runtime submits raw text to a trigger and cannot INSERT(value). Check six-place precision before conversion, attribute the author, and serialize forward-only starts per key. Replay committed intent before rejecting its now-occupied effective date.
- A sent RFQ is a fact from actual issuance, not an editable UI flag. Terminal won/lost history is append-only and actor-attributed; advisory locks plus unique constraints prevent two terminal outcomes. Keep original ownership and quotation events intact.
- A confidential report needs a separate endpoint and snapshot renderer. Preserve the customer allowlist and avoid master lookups/recalculation for historical reports. Fix metadata dates to the saved creation timestamp; test byte-identical saved rendering after rate changes.
- PDF footer text can create extra pages when the body bottom margin still applies. Disable bottom flow for footers, measure wrapped rows and keep quotation totals together. Independent PDF.js content/geometry plus raster review found defects that a successful PDF buffer alone would miss.
- Completed local unit/golden/PostgreSQL/Chrome/build/startup checks with disposable parents only; no cloud action or existing-history rewrite. Contracts, limitations and owner questions: docs/final-requirements-handoff.md.

## 2026-11-06 - Gemini production diagnostics

- A final HTTP 503 is not the provider HTTP status. Retain the numeric upstream status separately and correlate attempt events with the server-generated request ID. Provider 504 and the application deadline are different observations.
- Parse provider metadata privately, then project only fixed identifiers/numbers/booleans. Unknown reason/status/transport strings become OTHER; neither escaping nor truncating raw messages is a safe substitute. Re-project at the shared sink so arbitrary callback fields cannot leak.
- Emit abort diagnostics from the abort listener: waiting for an SDK rejection loses evidence if the SDK ignores cancellation. Clear the active attempt before writing, preventing duplicate logs from late settlement. Keep log-sink failures outside retry/control flow.
- The documented API_KEY_INVALID can arrive as HTTP 400 INVALID_ARGUMENT, so HTTP status alone is insufficient to classify authentication. An actual SDK mocked-transport test verifies that JSON parsing boundary without a real key or provider call.
- A pre-aborted request exposed an existing Promise.race ordering issue that could return a raw AbortError. Normalize cancellation at the provider and outer boundaries to preserve the existing controlled response. A deadline during backoff has no active provider attempt; correlate the prior event with HTTP AI_TIMEOUT rather than inventing another attempt.
- Completed 90 unit tests (25 focused Gemini), 24 local disposable PostgreSQL API/auth tests, 47 syntax checks, production build/startup 1/1. No production-root-cause claim, live Gemini call, configured environment change or cloud action. Handoff: docs/gemini-diagnostics-handoff.md.

# Learning log — fill during the build

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

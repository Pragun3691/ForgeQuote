# Learning log — fill during the build

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

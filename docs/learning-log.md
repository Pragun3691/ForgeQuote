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

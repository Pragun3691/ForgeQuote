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

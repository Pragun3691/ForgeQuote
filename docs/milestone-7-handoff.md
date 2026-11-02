# T01 Milestone 7 handoff - 2026-11-02

Completed on feature/T01-thin-slice from clean e677955f9097f23d83ebf9763467ae8bfe50e7b6. STOP before Milestone 8 or deployment. No formulas, golden expectations, historical snapshot rows or applied migrations 001-003 were changed/reset.

Implementation commits:

- 4c94f81 - authenticated RFQ/quotation API, migration 004 and transactional submission idempotency.
- 5e5ae65 - unsupported-RFQ regression and transaction ownership clarification.
- 6483c2c - React workspace, pending-key recovery and real Chrome coverage.
- 2490d03 - explicit maintenance-only runtime grant command.
- 6c6c4f1 - reject malformed pending submission storage; verified in Chrome without duplicate writes or page errors.
- Documentation handoff committed separately; final HEAD is reported in the chat.

## HTTP contracts

All business reads require a signed-in active estimator or sales head. All return no-store responses. POST also requires estimator role, exact application Origin and X-CSRF-Token. Actor identity always comes from the session. Decimal financial values/quantities/version numbers are strings.

| Method / path | Response / behavior |
| --- | --- |
| GET /api/rfqs | 200 `{ rfqs: [{ id, reference, customerName, dueDate, ownerLabel, status, partCount }] }`; empty array for empty register |
| GET /api/rfqs/:id | 200 RFQ metadata, Asia/Kolkata businessDate, parts with stored weight/quantity, identified routes and default tier quantities, plus saved-version metadata |
| POST /api/rfqs/:id/quote-versions | Idempotency-Key UUID header and body below; 201 `{ versionId, replayed: false }` for creation; 200 `{ versionId, replayed: true }` for replay; Location identifies saved GET |
| GET /api/quote-versions/:id | 200 complete immutable saved snapshot from the existing getDraftVersion service; no current-master recalculation |

Example synthetic POST body:

```json
{
  "pricingDate": "2026-11-02",
  "partId": "26110100-0000-4000-8000-000000000022",
  "routingRevisionId": "26110100-0000-4000-8000-000000000023",
  "marginPercent": "20",
  "tierQuantities": { "50": "90000", "100": "180000", "150": "270000" }
}
```

The URL supplies RFQ ID; the header supplies one key per intended calculation. All five body fields are required; unknown fields are rejected. The 100 scenario sets the new version's requested quantity; edits do not alter RFQ facts. Quantities range from 1 to 1000000000; margins are nonnegative plain decimal strings below 100 with at most six fractional digits. Body GST, costs/rates and role claims are rejected. T01 HTTP creation supports exactly one RFQ part and one selected routing operation; internal multi-part costing remains intact.

Errors use `{ error: { code, message, field? } }`: 400 malformed IDs/dates/decimals/quantities/body, 401 authentication, 403 role/CSRF, 404 missing RFQ/route/quotation, 409 SUBMISSION_CONFLICT, 413 body over 4 KiB, 422 RATE_NOT_FOUND or UNSUPPORTED_RFQ, 503 database/service failure. An uncertain save must be retried explicitly with the same key/body. No blind retry or fallback price. Readiness now checks migration 004.

## Database and idempotency

Migration 004 adds only draft_submissions and its guards. UNIQUE(actor_user_id, submission_key) is enforced by PostgreSQL. version_id references an immutable version, rfq_id references the RFQ, and actor_user_id references the authenticated creator. Receipts are append-only and must be inserted in the version's creation transaction. No new broad runtime UPDATE/DELETE grants; only SELECT/column INSERT on submissions. No existing ownership changes.

The submission service computes a canonical fingerprint over validated business fields, then checks actor/role, locks actor/key, looks up replay, creates the quotation with the **same transaction client**, inserts the key/fingerprint/version receipt and commits once. There is no separate quotation transaction in this path. Canonicalization normalizes UUID casing, margin trailing zeros and property order; CSRF/cookies/transient headers are excluded. See ADR-0006 for rationale and failure handling.

Actual verification: six concurrent same-key requests returned one 201 and five 200 responses with the same ID and exactly one new version. A different body/key reuse returned 409. A new intentional key produced another version. Injected receipt insertion failure left quotation/counter/children/submission counts unchanged. A simulated lost COMMIT acknowledgement surfaced once; replay returned the committed receipt without adding a version. The browser separately lost a real committed POST response and recovered the same way after refresh.

## Browser workflow and UI

Login -> real RFQ register -> open RFQ -> select pricing date/routing/margin/three annual quantities -> calculate/save through POST -> retrieve through GET -> render saved version and provenance. Version links/hash preserve selection across refresh. Both roles can read saved drafts; sales head has no create button and server rejects forged POSTs. Sign-out/expiry hide protected data.

Light industrial workspace with restrained teal, compact identity/navigation, stored part facts, right-aligned INR tables, clear draft/date/version labels, expandable rate provenance and scrollable tables on mobile. States implemented: session/RFQ/quote loading, empty register, native and server invalid inputs, missing historical rate, saving, successful save, uncertain network outcome with same-key retry, session expiry and forbidden action. No decorative dashboard or fake persisted values.

The UI stores pending key/body/phase in per-actor/per-RFQ sessionStorage **before POST**, survives refresh in the same tab, and blocks saving if storage is unavailable. Unknown outcomes freeze inputs; Start new calculation explicitly generates a new key. Confirmed rejected inputs may be corrected under their unused key. No credentials or CSRF token are placed in this storage. Tab closure/storage deletion loses pending recovery; saved URL/version history remain available.

Observed spindle results: 50% at 90000 units -> cost 120.44 / price 150.55; 100% at 180000 -> cost **119.76 / price 149.70**; 150% at 270000 -> cost 119.53 / price 149.41. Baseline annual taxable 26946000.00, illustrative GST 4850280.00, inclusive 31796280.00. All values came from saved GET data; changing the live RFQ weight did not change the displayed historical quotation.

Screenshots were generated and visually inspected locally at `.tmp/milestone7-desktop.png` and `.tmp/milestone7-mobile.png`. They contain only synthetic data, are ignored by Git and are regenerated by the browser test.

## Actual executed checks

| Command | Final result |
| --- | --- |
| npm.cmd test | 39/39 passed, including the unchanged golden/costing suite |
| npm.cmd run test:costing | 33/33 passed; all nine golden cases unchanged |
| npm.cmd run test:db | 44/44 reported passed: 40 subtests + 4 parent tests; existing auth/history/snapshot regressions plus HTTP/idempotency |
| node --test apps/api/test/quotation-api.test.js | 10/10 passed during development before adding the additional unsupported-RFQ subtest; final full suite includes that extra passing subtest |
| npm.cmd run build | Passed; production React assets generated |
| npm.cmd run test:browser | Passed in actual Chrome: wrong password, both roles, reload/logout, HTTP-only cookie, mobile viewport |
| npm.cmd run test:browser:quotation | Passed in actual Chrome: empty register; native/server validation; missing rate; all three saved scenarios and provenance; replay; changed-master isolation; refresh; full API process restart; committed-response loss/refresh/recovery; expiry/re-login; sales-head 403; anonymous 401; 390px no page overflow; malformed pending storage blocks saving; no page errors |
| npm.cmd run db:migrate | Applied only 004_draft_submissions.sql to local development; repeat applied [] |
| npm.cmd run db:grant-runtime | Passed through separate maintenance connection; explicitly reapplies reviewed SQL grants |
| npm.cmd run db:check-permissions | Passed; existing ownership limitation reported; new tables maintenance-owned |
| git diff --check | Passed |
| git diff against e677955 for migrations 001-003, calculate.js, costing.test.js, golden fixture/docs and costing-spec.md | No changes |

The first build attempt was blocked by sandbox parent-directory traversal permissions in esbuild; the approved execution outside that restriction passed. No failing final tests remain. The quotation browser test uses a generated dedicated test schema/non-owner runtime role and random test users, then removes only those fixtures. Its API runs in a real child process, which is stopped/restarted on the same port using the same database and session secret; this is more than constructing another Express app in one process. The legacy auth smoke uses the existing local demo identities and session storage, not production data. Tests never print connection strings/passwords.

## Local run commands

Keep ignored `.env` configured as in `.env.example`: runtime and separate maintenance URLs target local development, TEST_DATABASE_URL ends in _test, session secret/origin and synthetic demo passwords are present. No new environment variables are required for normal application use. First install with npm.cmd ci if needed.

```powershell
npm.cmd run db:migrate
npm.cmd run db:grant-runtime
npm.cmd run db:check-permissions
npm.cmd run db:seed
npm.cmd run db:seed-users
npm.cmd test
npm.cmd run test:db
npm.cmd run build
npm.cmd run test:browser
npm.cmd run test:browser:quotation
# For the development UI, use two terminals:
npm.cmd run dev:api
npm.cmd run dev:web
# Or serve the built same-origin UI locally with npm.cmd start
```

APP_ORIGIN must match the browser origin (normally Vite's local origin for development). Readiness fails until 004 is applied. Maintenance commands require MIGRATION_DATABASE_URL; omit it from deployed runtime settings. HTTP/browser tests need maintenance CREATE SCHEMA/ROLE capability on the dedicated test database and installed Chrome (or BROWSER_CHANNEL=msedge). Existing seeds reject drift rather than resetting data. No deployment was performed or authorized.

## Exact changed-file manifest

```text
README.md
apps/api/db/migrations/004_draft_submissions.sql
apps/api/db/runtime-grants.sql
apps/api/package.json
apps/api/scripts/check-permissions.js
apps/api/scripts/grant-runtime.js
apps/api/src/app.js
apps/api/src/draft-submissions.js
apps/api/src/errors.js
apps/api/src/quotation-request.js
apps/api/src/quotation-routes.js
apps/api/src/quotations.js
apps/api/src/rfqs.js
apps/api/test/app.test.js
apps/api/test/database.test.js
apps/api/test/quotation-api.test.js
apps/api/test/quotations.test.js
apps/web/src/QuoteResults.jsx
apps/web/src/Workspace.jsx
apps/web/src/api.js
apps/web/src/main.jsx
apps/web/src/styles.css
docs/architecture.md
docs/costing-engine.md
docs/current-status.md
docs/decisions/0006-http-submission-idempotency.md
docs/deployment.md
docs/learning-log.md
docs/milestone-7-handoff.md
docs/requirements.md
docs/ui-ux-direction.md
package.json
tasks/T01-thin-slice.md
tests/browser-quotation.smoke.js
tests/helpers/browser-server.js
tests/helpers/database.js
```

## Remaining issues and security limits

- Existing runtime database/users/sessions ownership still permits DDL/self-grants; public deployment remains blocked. New history tables are maintenance-owned. No ownership changed.
- This is a two-role synthetic demo, not tenant/owner-scoped authorization. Both active roles read every RFQ/draft; only estimator creates. Direct compromised runtime SQL can fabricate new history despite immutable committed records.
- Pending submission recovery is per tab/sessionStorage. Closing the tab, clearing storage or a different origin/browser loses it. Corrupt/unavailable storage blocks saving. Synthetic pending inputs remain in that tab after logout, scoped by actor; use no NDA/personal data.
- No quote-write throttle, pagination, receipt expiry/retention, load testing, deployed HTTPS, backup or disaster recovery validation. Existing login throttle remains process-local. Submission receipts intentionally do not expire.
- One part/one operation through HTTP; all quotations remain immutable drafts. No approval/issue/PDF/AI/rate-management screen or optional feature. Dedicated UI polish remains future work. No deployment and no Milestone 8 work.

## Three concepts for the owner

1. Why must key lookup, header allocation, snapshot writes and receipt insertion share one transaction/client, and what does the unique actor/key constraint protect?
2. Why does a failed HTTP response not prove rollback, and how do canonical fingerprints plus a retained key distinguish replay from a new calculation?
3. Why must the browser render the saved GET result while server-side role/CSRF checks and historical snapshots remain authoritative?

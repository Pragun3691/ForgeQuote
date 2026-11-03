# Development RFQ creation permission correction

Starting branch: feature/T03-multipart-quotations, clean HEAD 3b27c7f. Owner explicitly authorized focused diagnosis/correction; no T03 multipart implementation, push or deployment.

## Trace and fix

POST /api/rfqs applies current-user/estimator/Origin/CSRF/limit checks, canonicalizes input, starts a transaction, rechecks active estimator, takes actor/key advisory lock, checks replay, validates rate keys, inserts header/parts/routes and inserts the receipt before COMMIT. Any error rolls back; existing error handling redacts database details.

The exact failing application statement is INSERT INTO rfq_submissions(actor_user_id,submission_key,request_fingerprint,rfq_id) VALUES ($1,$2,$3,$4). A rollback-only development diagnostic isolated it and confirmed its internal users FOR KEY SHARE check returned 42501. No application query unnecessarily locks users. PostgreSQL runs the referenced-user FK check as the referenced table owner. Development actual runtime/session identity is forgequote_app, also users owner, with no UPDATE privilege before the fix. Normal fixtures used maintenance-owned users and missed this layout.

The minimal correction is a conditional GRANT UPDATE(id) ON users TO forgequote_app in the existing maintenance grant tooling, only if that role already owns users. The permission checker now verifies the exact conditional column ACL. Ownership and application queries/transaction/authentication are unchanged. No auth-field writes, users INSERT/DELETE, table-wide UPDATE or migration changes. ADR-0011 explains why the FK lock is necessary and why this grant is a real ID-update capability, not a locking-only permission.

## Changed files

- apps/api/db/runtime-grants.sql: conditional local owner column grant; maintenance-owned layout unchanged.
- apps/api/scripts/check-permissions.js: exact users column privilege check.
- tests/helpers/database.js: optional runtime-owned users only in disposable fixtures.
- apps/api/test/rfq-intake.test.js: complete HTTP regression for both ownership layouts and negative auth-field/DELETE permission checks.
- docs/current-status.md, docs/learning-log.md, docs/deployment.md, docs/decisions/0011-local-users-fk-privilege.md and this handoff: evidence and security exception.

## Actual verification

- New disposable runtime-owned case failed with HTTP 503 before the grant. Focused suite after fix: 26/26 passed.
- npm.cmd test: 78/78; test:costing: 33/33; test:db: 94/94. All nine financial goldens and persisted expectations unchanged. PostgreSQL increase from 81 is the second ownership variant of the complete RFQ suite.
- All six Chrome scripts passed: manual RFQ, Excel/mobile evidence, AI association, AI intake, quotation/recovery/persisted goldens, authentication. AI used mocks; no live provider claim.
- check:api: 40 modules; production startup: 1/1; frontend build passed after normal-access rerun of sandbox Vite path-access denial.
- Disposable parent database and fixtures removed. No migration/grant/data operation on existing forgequote_test, MedReach or cloud databases.

For development only, verified local ::1 port 5432 / forgequote_dev, actual postgres maintenance versus forgequote_app runtime, migrations 001-005 already present. Applied npm.cmd run db:grant-runtime; db:check-permissions passed with the preserved users/sessions owner warning. Runtime effective users UPDATE columns are exactly id; table-wide INSERT/UPDATE/DELETE/TRUNCATE remain false. Existing object ownership and all preexisting non-session JSONB row digests were preserved.

Authenticated actual API checks: readiness/login 200; new RFQ 201; reopen 200 with SP-101 and BR-202; same key/payload 200 with original RFQ ID; changed content on same key 409; anonymous 401; sales-head 403. Exactly one new synthetic RFQ, two parts/routes and one receipt were retained: SYNTH-PERM-e0d112bb. No existing development data was reset/deleted; session activity is expected. Maintenance credentials were not used by the application or exposed in logs.

## Remaining limits and owner questions

Development creation blocker resolved. Preserved runtime ownership of users/sessions and its owner powers remain unsuitable for public deployment; no ownership repair was attempted. Direct SQL UPDATE(id) is possible under the narrow ACL; no HTTP identity-edit capability exists. Financial/rate/snapshot/migration behavior remains unchanged. STOP before T03 or deployment.

1. Why did the receipt INSERT need a user row lock when the application user SELECT did not?
2. Why did maintenance-owned fixtures conceal the development failure?
3. Why is UPDATE(id) narrower than table UPDATE but still a real permission that must be disclosed?

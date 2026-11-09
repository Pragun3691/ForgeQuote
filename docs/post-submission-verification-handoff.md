# Post-submission verification and test synchronization

Recorded 2026-11-10. Owner-authorized continuation after the IsoCode submission. No application implementation was repeated. No production connection, migration, configuration change, deployment or Batch A/B work occurred.

## Recovered state and preservation

Recovery began on `fix/ai-concurrency-test-sync`, HEAD/local main `dc1fe07d9ddbb0288ec3fe4c9ae2e5c5e2033732`. A fresh remote fetch confirmed origin/main `eec0e833fdc0c795475547a3b8473bbcbfe75167`, its direct-parent relationship to the maintenance commit, and the remote maintenance branch at dc1fe07. Only `apps/api/test/ai-api.test.js` was tracked as modified. Submission packaging had also left two generated documents untracked; no application file had been changed during packaging.

The exact submitted archive remains `output/ForgeQuote_Submission.zip`, 173,292 bytes, SHA256 `8692c80af72b149ac9fc566572ccd053b66635a1e7841a520de1472da2d1f380`. Its immutable documented source reference remains dc1fe07, regardless of subsequent main history. Both companion files were compared against the archive and remain identical. Neither document was regenerated or edited for this continuation.

`.tmp/post-submission-resume-2026-11-10` preserves the ZIP, companion documents, hash manifest, initial diff/status, original local exclusion file and earlier navigation-failure screenshot. The directory is ignored and contains private submission artifacts. Two exact paths in `.git/info/exclude` keep the local PDF/access guide out of Git; ZIPs were already ignored. This local metadata change neither deletes files nor changes the tracked ignore policy. Do not publish the submitted access guide, include it in a source commit or print reviewer passwords.

## AI failure: root cause and correction

The failed assertion in the original `ai-api.test.js:133` expected `calls === previous + 2` after at most 50 ten-millisecond polling iterations. The observed 20 was a cumulative mock-provider count, not twenty simultaneous requests. This subtest intends to hold **two** extractions active and prove that a third receives HTTP 429 / AI_BUSY without another provider invocation.

HTTP dispatch, session loading and the authentication database read precede the provider callback. In the controlled reproduction, the first request advanced the counter to 19 while the second authentication lookup remained held; the poll expired and asserted 20 prematurely. Seven unchanged focused repetitions had passed, illustrating that passing fast runs did not make the bounded polling synchronization reliable. No production concurrency defect was established; the unchanged route checks/increments its in-flight count before awaiting extraction and decrements it in finally.

The correction is entirely in the test:

- A callback in the injected mock records actual provider starts.
- A deferred barrier resolves when both expected starts occur.
- The wait races that barrier against completion of either request; an early response/rejection still fails explicitly rather than hanging until a successful-looking count appears.
- Exact count assertions, third-request status/code, provider timeout, request cancellation and cleanup remain unchanged. No arbitrary sleep or production deadline was increased. No assertion was removed, skipped or relaxed; no application exception was suppressed.

The preserved diagnostics are precise about their limits: a held second authentication query reproduced the old poll failure; a separate controlled authentication scheduling delay passed with the correction; forcing authentication to terminate before the two starts failed with `Extraction completed before both provider calls started`. These are local test diagnostics, not live provider or production results.

## Failure history and current results

| Evidence | Result and interpretation |
| --- | --- |
| `.tmp/main-maintenance-db.log` | Original run: 202 passed / two failures counting child plus parent; 19-versus-20 concurrency assertion. Resolved by test synchronization. |
| `.tmp/ai-concurrency-original-1.log` through `-7.log` | Seven unchanged focused runs, 13/13 each. Does not disprove a timing-sensitive synchronization defect. |
| `.tmp/ai-concurrency-controlled-red.log` | Held authentication reproduced the exact old count failure. |
| `.tmp/ai-sync-controlled-green.log` / `.tmp/ai-sync-negative.log` | Controlled scheduling pass / expected early-completion failure; no production code changes. |
| `.tmp/ai-concurrency-fixed-1.log` through `-10.log` | Ten corrected focused runs, 13/13 each. Preserved, not overwritten. |
| `.tmp/ai-sync-full-db.log` | Complete pre-interruption API/database run: 204/204, no skips; guarded disposable databases. Preserved rather than falsely reported as newly executed in this resume. |
| `.tmp/ai-sync-browser-all.log` | Earlier full browser attempt stopped after an M1 keyboard-navigation timeout. No M1 assertion or application code was changed. |
| `.tmp/ai-sync-navigation-1.log` through `-5.log`; `.tmp/ai-sync-m1-repeat.log` | Five focused unchanged navigation runs and a full unchanged M1 run passed. Exact intermittent timeout cause remains unattributed. |
| `.tmp/ai-sync-browser-final.log` | Intentional submission interruption after eight completed passing suites. This was incomplete, not a full pass or an application failure. |
| `.tmp/resume-20261110-browser.log` | Fresh completed **23/23 browser suites**, process exit 0; all original assertions retained. Includes navigation/F1/F2, both roles, source review, PDFs, terminal closure and maintenance. |
| `.tmp/resume-20261110-ai.log` | Fresh focused AI HTTP suite **13/13**, no skips. |
| `.tmp/resume-20261110-unit.log` | Fresh units **96/96**, no skips. |
| `.tmp/resume-20261110-financial.log` | Fresh financial tests **33/33**, all nine goldens unchanged. Included within the unit count too. |
| `.tmp/resume-20261110-frontend.log` | Fresh frontend helpers **24/24**, no skips. |
| `.tmp/resume-20261110-syntax.log` | **48** API source/maintenance modules; changed test also passed direct `node --check`. |
| `.tmp/resume-20261110-build.log` / `-startup.log` | Production build passed, 62 modules, unchanged frontend asset hashes; normal production startup **1/1** passed. |

Commands: `node .tmp/t06-run.mjs tests/run-browser-suites.js`; `node .tmp/t06-run.mjs --test apps/api/test/ai-api.test.js`; `npm.cmd test`; `npm.cmd run test:costing`; the eight existing frontend-helper test files; `npm.cmd run check:api`; `npm.cmd run build`; `npm.cmd run test:production`. The preserved full database command was `node .tmp/t06-run.mjs .tmp/m5-m6-db.mjs`. Ignored wrappers verify loopback and create/drop dedicated disposable targets; no development or production database was reset, seeded or migrated. The build used the same reviewed local sandbox escalation needed by esbuild previously.

Counts include parent tests and overlap; do not sum them as unique tests. Actual Chrome coverage includes desktop/tablet/mobile/narrow layouts, keyboard/focus, reduced motion, contrast, host zoom and saved PDFs. This does not certify physical devices, other browser engines, live Gemini connectivity or provider control-plane behavior. The prior unexplained M1 timeout remains a historical verification watchpoint, not a newly established application defect or a currently failing gate.

## Exact tracked changes

1. `apps/api/test/ai-api.test.js` - actual-start synchronization and explicit premature-completion failure.
2. `docs/current-status.md` - current evidence, historical distinction and submission preservation.
3. `docs/learning-log.md` - synchronization lesson, negative controls and understanding checks.
4. `docs/maintenance-release-handoff.md` - label the earlier implementation checkpoint as historical and link this continuation.
5. `docs/maintenance-release-runbook.md` - reconcile source publication identity without authorizing production or weakening any release gate.
6. `docs/post-submission-verification-handoff.md` - this evidence/preservation/integration handoff.

All runtime/frontend source, migrations 001-008, financial engine/goldens, APIs, snapshots, authentication, authorization, idempotency and dependencies are unchanged from dc1fe07. The follow-up is a separate test/docs commit descending from dc1fe07; the maintenance commit remains distinct. Owner-authorized main integration uses only a normal fast-forward, with fresh remote comparison and post-push verification. Exact publication SHA/parents are recorded in Git history and the owner report; no self-referential commit hash is invented in this file.

## Production readiness and next owner actions

**NO-GO for production migration/deployment until the existing operator gates are verified and separately authorized.** Source integration does not identify the live Render SHA or establish production schema/maintenance status.

1. Under separately scoped read-only authorization, record Render's current full live SHA, deployment IDs, existing health path, desired/live mode, auto-deploy Off and no queued deploys. Verify actual replacement routing, termination, failed-candidate fallback and automatic restart semantics. Provider docs do not prove those conditions on this service.
2. Inventory every external SQL client, local API, worker, preview/job and reconnector. Establish a verifiable stop plan. If affirmative evidence that every old writable process has terminated or that traffic is isolated is unavailable on the Free service, stop; do not infer it from elapsed time, a saved flag, a Live label or one maintenance response.
3. Only in an authorized window, follow `maintenance-release-runbook.md` exactly: deploy the reviewed capability SHA in true mode with existing liveness bootstrap health; verify old-instance termination and drained clients/transactions; switch to deployment health while still true and reverify any replacement. No migration before the barrier is proven.
4. Privately verify direct runtime/maintenance identities, same intended target, verified TLS, READ COMMITTED, ledger/checksums, client/prepared-transaction drain and PostgreSQL version. Take a maintenance backup and perform an isolated restore/data-manifest check. Optional Neon features depend on actual Free entitlements; they are not assumed available.
5. While still in maintenance, apply only pending 008 and existing narrow grants with reviewed preparation tooling; run the strict cloud permission check and compare historical manifests. No seed/reset or historical rewrite. Use the runbook's exact PowerShell commands, not submission-local setup instructions.
6. After all gates and explicit reopening approval, deploy the **same** reviewed SHA in false mode with strict 008 deployment health. A failed candidate must leave verified maintenance active. Generic Render Rollback is prohibited because it can reuse an older health path/environment. Recover with the reviewed capability in true mode; do not expose an older writable release or downgrade the schema.
7. Preserve the existing APP_ORIGIN and SESSION_SECRET. After successful normal promotion, verify both roles, historical reads and eligible PDFs without creating test production business records. Production migration, configuration, deployment and Batch A/B remain outside this continuation.

Provider references rechecked during this continuation: [replacement/restart sequence](https://render.com/docs/deploys), [new-deployment health and fallback](https://render.com/docs/health-checks), [rollback settings](https://render.com/docs/rollbacks). Actual service state remains unverified. See the runbook for failure handling at each gate; uncertainty is a blocker, not a reason to relax readiness.

## Rollback and owner review

No database rollback is needed for this test/docs change. Before publication, restore only these task-specific changes from the preserved baseline after checking for later owner edits. After publication, use a normal reviewed revert commit if needed; never reset/rebase/force-push history. Reverting this follow-up does not remove the maintenance capability. Do not alter the submitted ZIP, its companion files or their dc1fe07 reference, and do not stage ignored submission artifacts during any recovery.

Understanding checks: What does the cumulative count 20 measure? Why must premature request completion still fail the new wait? What provider/database evidence is required before migration even after a local 23-suite pass?

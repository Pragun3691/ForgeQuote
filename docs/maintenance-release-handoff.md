# Free maintenance safety handoff

Historical implementation checkpoint: the maintenance capability was subsequently committed/pushed as `dc1fe07d9ddbb0288ec3fe4c9ae2e5c5e2033732`. The owner-authorized post-submission test-only correction, completed browser rerun, submitted-artifact preservation and main integration are recorded in [post-submission-verification-handoff.md](post-submission-verification-handoff.md). Original no-commit/unstaged statements below describe this handoff's earlier checkpoint; they are not current Git status. No production operation is implied by source publication.

Complete locally; stop for owner review. No staging, commit, push, merge, production connection, Render/Neon change or deployment. This is implementation/rehearsal evidence, not production release authorization.

## Branch and preserved baseline

Branch `feature/free-maintenance-safety`, HEAD/parent `eec0e833fdc0c795475547a3b8473bbcbfe75167`. The initial working tree was clean. `.tmp/maintenance-before` preserves 274 exact tracked/nonignored files, SHA-256 hashes, branch/HEAD, status and both patches. Existing checkpoints remain in place; no reset, clean, stash or discarded work.

No migration was added or changed. Original 001–008, financial engine, all nine external goldens, authentication implementation, TLS policy, quotation/lifecycle services, snapshots, request receipts and PDF renderers remain unchanged. No new dependencies or production records. `.env.example` adds a nonsecret explicit false example; the actual local `.env` was not modified. Render YAML changes are proposed code/configuration only; no service settings were applied.

## Behavior

- `MAINTENANCE_MODE` accepts only literal true/false; absent means false. Invalid/blank/alternate values fail configuration. It is fixed at process creation; changing desired environment cannot terminate or reconfigure an old process.
- Maintenance server creates no application pool. The app returns before auth/session-store, session pruning, provider/import/business route and static/SPA installation. Thus health/normal requests cannot create sessions, recover/expire cookies, save data, prune sessions or invoke providers.
- Ordinary requests return 503, Retry-After 60, no-store, and no Set-Cookie. API responses use controlled `MAINTENANCE` JSON; other routes use an original self-contained accessible ForgeQuote page. No script, remote asset, automatic write retry or bypass token.
- Liveness remains 200/DB-free. Readiness is 503 in maintenance and retains strict 008 checks normally. New GET/HEAD `/api/health/deploy` is 200 in maintenance (`applicationReady:false`) and shares exactly the normal 008 readiness function when false. No 007 normal-readiness exception or cache was introduced.
- Server shutdown handles the no-store/no-pool case and repeated signals safely. Startup logs the nonsecret mode; successful graceful shutdown logs completion. Normal auth/session/CSRF/idempotency/financial/PDF behavior remains intact when maintenance is disabled.
- Repository Render health path becomes `/api/health/deploy`, and the maintenance variable is operator-controlled (`sync:false`) so Blueprint values cannot reset an active barrier. Auto-deploy remains Off; no public URL/APP_ORIGIN/SESSION_SECRET change.

## Required release ordering

The full, PowerShell-compatible procedure is [maintenance-release-runbook.md](maintenance-release-runbook.md); rationale is ADR 0029.

1. After owner review, separately authorize commit/push/main integration and record the exact new capability SHA. Baseline eec0e83 is not that new target.
2. Set true with Render Save only. Deploy the reviewed capability build using existing liveness health for first bootstrap on schema 007. Old writable instances can continue until terminated; do not declare a barrier merely because the new process is healthy.
3. Require affirmative evidence every older writable process exited, database clients/transactions drained and external reconnecting writers stopped. Unknown provider behavior means no migration.
4. While still true, install/verify the deployment health path. Any replacement caused by that change must also finish/drain. Verify desired and live configuration.
5. Verify private identities, direct TLS, READ COMMITTED, ledger/checksums, backup and isolated restore/data manifest. Apply 008 and narrow grants, run cloud checks and compare historical rows while maintenance remains active.
6. Explicitly deploy the same reviewed SHA with false only after all gates pass. Strict 008 deployment health prevents an unready normal candidate being promoted. A failed candidate must retain the current maintenance deployment; actual provider fallback/restart behavior still requires verification.
7. Successful normal promotion is the explicit reopening. Verify both roles and existing historical reads/PDFs without creating test business records in production.

Do not use Render Rollback during this procedure: it can restore the target's old environment AND health path, defeating both controls. Recovery is an explicit reviewed capability deploy in true mode, not a pre-maintenance artifact. No downgrade, trigger disabling, migration-ledger deletion or automatic production restore. The code cannot fence privileged SQL/Render operators who ignore the protocol.

## Tests and exact results

| Gate | Command | Result |
| --- | --- | --- |
| Expected red reproduction | `node --test apps/api/test/maintenance-mode.test.js` before implementation | Missing flag/gates reproduced; failure log retained. |
| Focused mode/process/scheduler | `node --test apps/api/test/maintenance-mode.test.js` | 6/6, including strict configuration, route/method matrix, poisoned pool, simulated prune intervals, real production-mode maintenance process and real shutdown handler. |
| Focused real release procedure | `node .tmp/t06-run.mjs --test apps/api/test/maintenance-deployment.test.js` | 7/7: failed activation, held old COMMIT/drain, 007 maintenance/premature reopening, transactional DDL failure/retry, failed/legacy candidates, session/receipt/golden preservation after 008. |
| Full units | `npm.cmd test` | 96/96 (90 existing + 6 new), no skips. |
| Full API/database | `node .tmp/t06-run.mjs .tmp/m5-m6-db.mjs` | 204/204 (197 existing + 7 new), no skips; guarded disposable local targets only. |
| Browser | `node .tmp/t06-run.mjs tests/run-browser-suites.js` | 23/23: all 22 existing, including F1/F2, plus maintenance. |
| Focused browser | `node .tmp/t06-run.mjs tests/browser-maintenance.smoke.js` | PASS: both real roles, stale save/approval 503, unchanged cookies/session count, retained margin, identical retry keys/bodies, exactly one resulting save/approval, historical PDF, four viewports and keyboard/reduced-motion checks. |
| Frontend helpers | `node --test tests/rate-authoring.test.js tests/rate-view.test.js tests/intake-validation.test.js tests/intake-review.test.js tests/m1-state.test.js tests/register-view.test.js tests/ui-format.test.js tests/ui-evidence.test.js` | 24/24. |
| Financial | `npm.cmd run test:costing` | 33/33; all nine goldens byte-identical (also included within unit tests). |
| Syntax | `npm.cmd run check:api` | 48 source/maintenance modules passed. |
| Build | `npm.cmd run build` | PASS, 62 modules; unchanged normal frontend assets `index-DqHjHQXk.js` / `index-rUvFg2wQ.css`. |
| Normal production startup | `npm.cmd run test:production` | 1/1; existing normal startup/React/liveness/offline-readiness assertions preserved. |
| Native backup/restore rehearsal | `node .tmp/t06-run.mjs .tmp/maintenance-native-check.mjs` | PASS: actual PostgreSQL 17 pg_dump, archive inspection, new isolated pg_restore, exact runbook preservation SQL and matching numeric/timestamp row digests. No development/production targets. |
| Runbook syntax | Node `--check` and Windows PowerShell AST parser on extracted blocks | Embedded JavaScript and all six PowerShell blocks passed; no production command executed. |

The disposable release test runs actual applications/HTTP requests/PG transactions behind a local routing model. It deliberately permits an old in-flight COMMIT after maintenance health succeeds, then requires old server/store/pool closure before migration. It starts with real 001–007 plus a checksummed ledger; failed 008 DDL rolls back prior replaced guards and ledger; retry adds only 008 and leaves protected row fingerprints unchanged. Session data/password material is fingerprinted internally rather than printed. The pre-capability candidate fixture models its missing deployment endpoint; it is not a full historical Render image.

Existing terminal tests also preserve the Won-before-later-Version-3 history and exact customer/INTERNAL PDF buffers. No accepted workflow/financial assertion was weakened. The one existing configuration expectation intentionally moves from the old liveness health path to deployment health, adding a check for operator-controlled mode. Normal liveness, auth and production-startup assertions are unchanged.

Development fixture issues were corrected without changing product behavior: the saved-snapshot test uses the established `part.result.tiers` contract; pruning waits for the library's callback. On Windows, killing a child does not deliver POSIX SIGTERM to JS. The new test uses test-only child IPC to emit the signal and exercise the actual handler; two identified hung test-runner PIDs from the initial harness were stopped, without touching any development server. The original expected-red log is retained; final green logs are listed below. Initial fixture corrections are described here rather than claiming every intermediate failed output was retained.

## Screenshots and artifacts

Actual Chrome screenshots, personally inspected:

- [1440×1000](../.tmp/maintenance/maintenance-1440.png)
- [768×1024](../.tmp/maintenance/maintenance-768.png)
- [390×844](../.tmp/maintenance/maintenance-390.png)
- [320×844](../.tmp/maintenance/maintenance-320.png)

The notice has no page overflow at tested widths, a keyboard-visible retry link, no animation and the approved charcoal/forest/ivory/crimson identity. Existing M2/M8 suites additionally pass normal product contrast, reduced motion and real Chrome 200%/400% zoom checks. Actual post-maintenance INTERNAL PDF: `.tmp/maintenance/after-maintenance-internal.pdf`; browser results JSON is alongside it. No PDF renderer changes.

Logs: `.tmp/maintenance-{unit,all-unit,deployment,db,browser,browser-all,helpers,financial,syntax,build,startup,native}.log`. Native backup data is synthetic disposable-test content. All logs, PDFs, screenshots, local test harnesses, dumps and checkpoints are ignored artifacts, not commit files.

## Limitations and production blockers

- No Render/Neon production control-plane or database validation. Local process/routing tests do not certify the actual provider. Positive old-instance termination, routing isolation, fallback and automatic restart configuration behavior are mandatory operator checks. If any is uncertain, production execution remains blocked.
- No atomic global environment switch, distributed DB write fence, instantaneous fleet stop or protection against a privileged operator deliberately choosing unsafe config/rollback. Old processes keep their startup mode. External SQL clients and reconnectors must be stopped separately.
- Application health cannot certify all grants/trigger definitions or backups; the separate operator gates do. Production identities, PG major/TLS, READ COMMITTED, ledger, entitlements/quotas and verified restore remain unverified here. Free-compatible does not mean unlimited compute: normal deployment health queries PostgreSQL and can affect Free usage while Render runs. Maintenance health is DB-free.
- No bypass for production workflow testing while maintenance is active. Rehearse on isolated data; successful normal promotion is reopening. Do not create production RFQs/outcomes as a smoke test.
- Ordinary unsent drafts keep their existing authenticated-tab memory lifetime. Keep existing tabs open; hard navigation/session teardown can still end that lifetime. Submitted intent keeps its existing sessionStorage recovery. Maintenance does not create new draft persistence.
- Browser verification is real local Chrome, not Safari/Firefox, physical devices or assistive-technology testing. No live provider request. No Linux Render signal/control-plane claim; Windows handler testing is explicitly modeled.

## Original pre-commit rollback checkpoint (historical)

No commit exists for this assignment. Record/save later owner edits before undoing anything. Review the file list below; restore only this assignment's modified paths from `.tmp/maintenance-before` and remove only its newly added paths. Do not reset/clean/stash or overwrite later edits. No development/production database rollback is needed: neither was migrated here.

After a future release, retain 008 guards/history; recover with the reviewed maintenance-capable build in true mode and verified deployment health. A disaster restore is separately authorized and offline: apply 008/grants before any application exposure. Do not roll back to an old writable artifact or restore a 007 backup online.

## Exact changed files

20 files: 12 modified, 8 new, 0 deleted; all unstaged. 262 other baseline files remain byte-identical. 71 protected migration/financial/auth/PDF/frontend files were compared with no changes. Added/new content has no secret-pattern findings; one existing synthetic TLS-test credential URL was compared with baseline and remains unchanged. No unexpected binaries/generated artifacts. This is a local pattern review, not an external security audit.

- `.env.example`
- `apps/api/package.json`
- `apps/api/src/app.js`
- `apps/api/src/config.js`
- `apps/api/src/server.js`
- `apps/api/test/deployment.test.js`
- `docs/architecture.md`
- `docs/current-status.md`
- `docs/deployment.md`
- `docs/learning-log.md`
- `render.yaml`
- `tests/run-browser-suites.js`
- `apps/api/src/maintenance-mode.js`
- `apps/api/test/maintenance-deployment.test.js`
- `apps/api/test/maintenance-mode.test.js`
- `docs/decisions/0029-maintenance-release-gate.md`
- `docs/maintenance-release-handoff.md`
- `docs/maintenance-release-runbook.md`
- `tasks/maintenance-release-safety.md`
- `tests/browser-maintenance.smoke.js`

## Owner understanding checks

1. Why can maintenance health be 200 while application readiness is 503 on schema 007?
2. What proves old writers have stopped, and why are Save only, a new 503 response or a fixed wait insufficient?
3. Why is a generic Render Rollback unsafe even after adding the new deployment health endpoint?

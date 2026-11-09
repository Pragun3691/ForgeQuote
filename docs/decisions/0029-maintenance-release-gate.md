# ADR 0029 — Explicit maintenance and a deployment health gate

Status: owner-approved scope; local implementation only. No production operation is authorized by this document.

## Decision

Use a process-start `MAINTENANCE_MODE` flag, accepting exactly `true` or `false`, absent meaning false. Invalid values abort configuration. There is no header, cookie, query, privileged HTTP bypass, automatic enablement, timer-based reopening or database flag. Existing authentication configuration checks still apply in maintenance, including exclusion of maintenance/seed credentials from the production application environment.

Maintenance processes construct neither an application database pool nor a session store. `createApp` installs health routes and then a terminal 503 responder instead of auth, session pruning, providers, imports, business routes and static/SPA fallback. Normal configuration keeps the original routes, role/CSRF behavior, session lifetime, recovery and PDFs. All legitimate non-health requests, including reads and unknown methods/paths, receive 503, Retry-After 60 and no-store. No cookies are created or cleared. The HTML notice has no scripts, remote assets, provider calls or automatic retries.

Health semantics:

| Endpoint | Maintenance | Normal |
| --- | --- | --- |
| GET/HEAD `/api/health/live` | 200 alive, no DB | Unchanged 200 alive, no DB |
| GET/HEAD `/api/health/ready` | 503 not_ready / maintenance, no DB | Existing strict migration-008 readiness |
| GET/HEAD `/api/health/deploy` | 200 maintenance / applicationReady:false, no DB | The exact same strict 008 readiness function |

This distinguishes a healthy maintenance process from an application ready for quoting. It does not report 007 as a current normal schema. There is no new schema migration or change to 001–008. Normal-mode health checks bypass sessions and cannot start their pruning timer. The installed connect-pg-simple version initializes its pruning timer through session operations, not merely construction; maintenance avoids construction altogether.

## Bootstrap, overlap and failure

The first maintenance-capable build is a descendant of accepted commit `eec0e833fdc0c795475547a3b8473bbcbfe75167`, which includes migration 008 source but need not have applied it. Deploy that reviewed build with the flag true using the existing `/api/health/live` bootstrap path. It can start on 007 without using the database.

Old writable instances may keep serving requests and pruning sessions during replacement. Changing an environment variable, receiving a maintenance response, seeing a new commit marked live, or waiting a fixed number of seconds is not independently sufficient evidence of quiescence. Require affirmative provider evidence that every older writable process has terminated, plus drained database clients/transactions and stopped external writers. Uncertainty blocks migration. Local tests deliberately hold an old transaction open after the maintenance process becomes healthy to prove this distinction.

Only after that barrier is established, switch the actual Render health path to `/api/health/deploy` while the flag remains true. Verify the resulting deployment also runs the reviewed build in maintenance. Do not apply the Blueprint health-path change to an old build that lacks the endpoint. Keep auto-deploy off and avoid unordered Blueprint synchronization.

Back up, restore-test, apply 008 and narrow grants, then check permissions while all application instances remain in maintenance. Deactivate only by an explicit exact-commit deployment with the flag false after those gates pass. The new normal candidate requires 008; if startup/health fails, Render's documented behavior retains the currently live maintenance deployment. A manually deployed pre-capability build lacks the deployment endpoint and fails the current gate. This is not a blanket guarantee about operator rollback or changed health settings.

**Do not use Render's Rollback action during this procedure.** Render restores the target deployment's environment and health-check path. A pre-maintenance snapshot can therefore undo both safeguards. Recovery uses Manual Deploy of the reviewed maintenance-capable commit with true and the deployment gate; never an old writable snapshot. The application cannot constrain a privileged operator who deliberately changes those controls or connects directly to PostgreSQL.

## Alternatives and scope

Suspension alone cannot maintain a controlled barrier through resume/deploy. Idle spin-down is not a barrier. Paid maintenance is unnecessary and would not stop background writers by itself. Temporary database privilege revocation is more invasive, requires careful grant restoration and can be undone by cloud preparation. A separate service/database control plane would add dependencies and a new security boundary. This process flag plus health gate reuses existing Render Free controls and requires no Neon paid feature.

External SQL clients, local servers, jobs, previews and integrations remain an operator responsibility. Runtime health is not a distributed write fence. A normal candidate must not receive application traffic before deployment health success; if the actual platform routing/termination behavior cannot be verified, stop rather than weaken the protocol.

Normal deployment-health polling intentionally performs the strict schema query; this can affect Free compute usage while Render is running. Verify real budgets/polling behavior before release. Maintenance probes perform no database queries. No positive-readiness cache or weaker normal readiness was introduced to hide that tradeoff.

## Evidence and operational limits

Tests use poisoned database objects, simulated scheduling intervals, actual child processes, real HTTP instances with held PostgreSQL commits, schema 007 fixtures, migration failure/retry and Chrome. They model the documented Render routing protocol; they do not independently exercise Render or Neon production. Windows child-process tests emit SIGTERM inside the child via test-only IPC to exercise the real handler; they do not claim Windows delivers POSIX signals like Linux.

Full evidence, exact files and rollback: `../maintenance-release-handoff.md`. Operator procedure: `../maintenance-release-runbook.md`.

Provider documentation reviewed: [deployments and graceful replacement](https://render.com/docs/deploys), [health checks](https://render.com/docs/health-checks), [environment Save only semantics](https://render.com/docs/configure-environment-variables), [rollback configuration behavior](https://render.com/docs/rollbacks), [Free limitations](https://render.com/docs/free). Actual service behavior and plan/backup conditions still require separately authorized operator verification.

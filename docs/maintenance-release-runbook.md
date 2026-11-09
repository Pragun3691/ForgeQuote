# Render Free maintenance / migration 008 release runbook

**Future operator procedure, not execution authorization.** No production connection, configuration change, backup, migration, deployment or production test was performed while writing this. Stop at every failed or uncertain gate. No purchase, domain change, database reset, seed, password rotation, downgrade or new production test record is part of this procedure.

## 0. Release identity, approval and remaining verification

Current development baseline: `eec0e833fdc0c795475547a3b8473bbcbfe75167`. It is NOT the maintenance-capable deployment target. After owner review, separately authorize the maintenance commit, push and main integration. Record its full SHA as `$ReleaseCommit`; use that exact reviewed commit for maintenance activation and normal reopening. A capability build may contain migration 008 without applying it.

The implementation is locally tested, not independently tested on Render's control plane. Before starting, verify the real service's replacement/routing/termination controls. If positive evidence of old-process termination or traffic isolation is unavailable, **deployment is blocked**. Do not substitute a timer, a single health response or an environment Save operation for that evidence.

Manual Render/Neon checks, under separate owner authorization:

- Service `forgequote`, Free, repository/branch main, auto-deploy Off, no queued deploys/rollbacks, single intended production service; inventory previews, workers and external clients too.
- Record existing live commit, health path, shutdown settings and deployment identifiers. Initially an older build can use `/api/health/live`; do not change that to an endpoint it does not have.
- Keep `APP_ORIGIN=https://forgequote-demo.onrender.com` exactly, with no trailing slash. Preserve `SESSION_SECRET`, runtime credentials, URL and all existing production settings apart from the explicitly approved maintenance flag and deployment-health path. Do not import a local `.env` into Render or sync the new Blueprint out of order.
- Confirm actual Neon project/production branch, documented `neondb` database, PostgreSQL major, Free entitlements, history window and optional snapshot/branch quota. Do not infer these from the code. No paid Neon feature is required; a direct `pg_dump` and an isolated local restore are the required backup path. A native snapshot is supplemental only if available and separately authorized.
- Local installed clients during development were PostgreSQL 17.11. Verify server compatibility before using them; use matching-major clients and an appropriate isolated restore server. Never bypass a version/certificate error.
- Inventory and stop local processes, SQL editors, jobs, previews/integrations and other clients that can reconnect/write. The maintenance flag controls this application process, not arbitrary SQL credentials.
- Normal deployment-health probes perform the strict read-only schema query and can affect Neon Free compute usage while Render is running. Check actual compute/bandwidth budgets and polling/spin-down behavior; no claim of unlimited Free usage or a paid fallback is made. Maintenance health has zero database traffic.
- Verify failed-deploy fallback and any automatic restart use the currently live maintenance artifact/configuration, not a failed candidate's desired false flag or an older writable artifact. If this behavior cannot be established on the actual service, deactivation is blocked. After a failed reopening, restore desired true and reverify rather than leaving ambiguous saved settings.

Sources: [Render replacement sequence](https://render.com/docs/deploys), [health checks](https://render.com/docs/health-checks), [environment Save only](https://render.com/docs/configure-environment-variables), [rollback behavior](https://render.com/docs/rollbacks), [Neon plans](https://neon.com/docs/introduction/plans), [Neon direct backup connections](https://neon.com/docs/manage/backup-pg-dump). Recheck current controls before an actual release.

## 1. Operator workstation and secret handling

Use a private PowerShell session in the repository, not a transcript/screen-sharing session. Do not print URLs, passwords, session tokens, password hashes, secret files or full environment listings. Backups contain sensitive sessions and credentials: use encrypted, access-restricted storage outside the repository and OneDrive. Preserve all artifacts until the owner approves retention/cleanup.

Privately prepare an ACL-restricted `$OperatorEnv` file outside the repository containing only the required administrative settings: `NODE_ENV=production`, `DATABASE_TLS_MODE=verify-full`, direct runtime `DATABASE_URL`, direct same-target/different-role `MIGRATION_DATABASE_URL`, `CLOUD_DATABASE_NAME=neondb`, verified direct `CLOUD_DATABASE_HOST`, and a CA setting only if required by the existing verified TLS policy. No maintenance/test/seed credentials enter the Render app. An operator environment file does not change the remote maintenance flag.

Privately configure libpq profiles in `%APPDATA%\postgresql\.pg_service.conf` and passwords in protected `pgpass.conf`, not command arguments:

- `fq_prod_maintenance`: exactly the host/port/database/maintenance role validated by `$OperatorEnv`, direct/unpooled, verified TLS and correct trusted CA.
- `fq_restore_admin`: loopback on an isolated compatible PostgreSQL server, maintenance database `postgres`; never development/production as a restore destination.

Check profiles privately against the approved endpoints. Do not paste their contents into logs/chat. Pooled connections are not used for dumping/migration. No role/isolation override may mask the runtime's real settings.

```powershell
$ReleaseCommit = '<owner-approved full maintenance-capable commit SHA>'
$OperatorEnv = '<private absolute operator configuration path>'
$ReleaseDir = Join-Path $env:LOCALAPPDATA 'ForgeQuote\release-008'

if ($ReleaseCommit -notmatch '^[a-f0-9]{40}$') { throw 'Record the approved SHA first' }
if ((git rev-parse HEAD).Trim() -ne $ReleaseCommit) { throw 'Wrong checkout' }
if (git status --porcelain) { throw 'Dirty checkout' }
# --env-file does not override inherited variables. Refuse ambiguity.
foreach ($key in @('DATABASE_URL','MIGRATION_DATABASE_URL','CLOUD_DATABASE_NAME',
 'CLOUD_DATABASE_HOST','DATABASE_TLS_MODE','DATABASE_CA_CERT','NODE_ENV',
 'NODE_OPTIONS','NODE_TLS_REJECT_UNAUTHORIZED','MAINTENANCE_MODE')) {
 if (Test-Path "Env:$key") { throw "Conflicting operator environment: $key" }
}
if (Get-ChildItem Env: | Where-Object { $_.Name -like 'PG*' }) {
 throw 'Inherited libpq settings are ambiguous; use the reviewed private service profiles in a clean operator process'
}
pg_dump --version
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL tools unavailable' }
pg_restore --version
if ($LASTEXITCODE -ne 0) { throw 'Restore tool unavailable' }
New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null
$Origin = 'https://forgequote-demo.onrender.com'
```

## 2. Activate maintenance before migration — manual Render

1. Announce the window. Ask users to keep work tabs and pending request keys/inputs. Do not clear browser storage or retry uncertain requests with new keys.
2. Environment: set `MAINTENANCE_MODE=true` using **Save only**. This does not change old processes. Do not select Save and deploy, which can use an unintended current artifact.
3. Keep the existing `/api/health/live` health path for this first bootstrap. Manual Deploy → Deploy a specific commit → `$ReleaseCommit`. No Blueprint synchronization or simultaneous deploy/config edit.
4. Verify the candidate's commit, startup log `maintenance=true`, successful deployment and maintenance responses. A failed build/start leaves the old writable release active on schema 007: **do not migrate**.
5. Wait for affirmative evidence that all older writable processes exited. The provider's documented sequence includes an overlap after routing changes before SIGTERM. Our handler has a 10-second shutdown ceiling; none of these timers alone prove termination. New capability builds log `ForgeQuote shutdown complete`; older builds do not, so obtain provider-side evidence for them. Check that no old deploy is queued to return.
6. Stop external clients/reconnectors and verify database drain using the read-only checks below. Only then declare the barrier established and record its time/evidence.
7. While true remains set, change the actual health path to `/api/health/deploy`. If this action triggers a replacement, require the same commit, true mode, completed old-instance termination and drain again. Verify current health path and current deployment. Never change it back during the release.

The maintenance deployment endpoint must return 200 with `status=maintenance`, `applicationReady=false`; readiness must be 503 and ordinary requests must be 503 with Retry-After/no-store and no cookies. Do not test application mutations merely to establish the barrier.

```powershell
function Get-ReleaseStatus([string]$Path) {
 try { return [int](Invoke-WebRequest -UseBasicParsing -Uri "$Origin$Path" -MaximumRedirection 0).StatusCode }
 catch {
  if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
  throw
 }
}
$health = Invoke-RestMethod "$Origin/api/health/deploy"
if ($health.status -ne 'maintenance' -or $health.applicationReady -ne $false) { throw 'No verified maintenance response' }
foreach ($path in @('/','/api/auth/session','/api/rfqs','/api/health/ready')) {
 if ((Get-ReleaseStatus $path) -ne 503) { throw "Barrier check failed: $path" }
}
if ((Get-ReleaseStatus '/api/health/live') -ne 200) { throw 'Maintenance process unhealthy' }
```

These HTTP checks are necessary but do not prove old-instance termination. If provider behavior, actual routing or shutdown evidence is uncertain, keep maintenance and stop here.

## 3. Read-only identity, isolation, ledger and drain verification

Run only after separate production read-only authorization and positive provider termination evidence. The following uses the same pool/TLS validation as the app. It checks both direct identities, distinct roles, runtime restrictions, ledger checksums and drained clients without printing identities or secrets. Run at phase 007 before backup and at phase 008 after preparation. It does not change isolation to make a failed default pass.

```powershell
$VerifyTarget = @'
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readConfig} from './apps/api/src/config.js';
import {readMaintenanceUrl} from './apps/api/src/maintenance.js';
import {validateCloudConnection} from './apps/api/src/cloud-database.js';
import {createPool} from './apps/api/src/db.js';
try {
 const phase=process.argv[2];assert.ok(['007','008'].includes(phase));
 const config=readConfig();assert.equal(config.nodeEnv,'production');
 validateCloudConnection(config);const maintenance=readMaintenanceUrl();
 const names=(await readdir('apps/api/db/migrations')).filter(n=>/^\d+.*\.sql$/.test(n)&&n.slice(0,3)<=phase).sort();
 const expected=[];for(const name of names){const sql=await readFile('apps/api/db/migrations/'+name,'utf8');expected.push({name,checksum:createHash('sha256').update(sql.replaceAll('\r\n','\n')).digest('hex')});}
 for(const [kind,url]of [['runtime',config.databaseUrl],['maintenance',maintenance]]){
  const pool=createPool(url,config);let client;try{
   client=await pool.connect();await client.query('BEGIN READ ONLY');
   const identity=(await client.query(`SELECT current_database() AS db,current_user AS actor,session_user AS login,
    current_setting('default_transaction_isolation') AS default_isolation,
    current_setting('transaction_isolation') AS isolation,
    (SELECT pg_get_userbyid(datdba)=current_user FROM pg_database WHERE datname=current_database()) AS owner`)).rows[0];
   const parsed=new URL(url);assert.equal(identity.db,decodeURIComponent(parsed.pathname.slice(1)));assert.equal(identity.actor,decodeURIComponent(parsed.username));assert.equal(identity.actor,identity.login);
   assert.equal(identity.default_isolation,'read committed');assert.equal(identity.isolation,'read committed');assert.equal(identity.owner,kind==='maintenance');
   if(kind==='runtime'){
    const role=(await client.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];assert.ok(Object.values(role).every(v=>v===false));
    assert.equal((await client.query('SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)')).rowCount,0);
   }
   assert.deepEqual((await client.query('SELECT name,checksum FROM public.schema_migrations ORDER BY name')).rows,expected);
   if(kind==='maintenance'){
    assert.equal((await client.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'")).rowCount,0);
    assert.equal((await client.query('SELECT 1 FROM pg_prepared_xacts WHERE database=current_database()')).rowCount,0);
   }
   await client.query('ROLLBACK');console.log(kind+': identity, isolation, ledger verified');
  }finally{if(client){await client.query('ROLLBACK').catch(()=>{});client.release();}await pool.end();}
 }
 console.log('Target verification and drain checks passed; retain separate provider termination evidence.');
}catch{console.error('Release verification failed. STOP; do not print connection/error objects.');process.exitCode=1;}
'@
$VerifyTarget | node "--env-file=$OperatorEnv" --input-type=module - 007
if ($LASTEXITCODE -ne 0) { throw 'Pre-migration gate failed' }
```

An unexpected 008 already applied, additional migration, mismatch, non-owner maintenance role, role membership, wrong branch/endpoint, masked/unverifiable connection state, ongoing reconnectors or prepared transaction is a stop condition. Do not terminate unknown sessions or change roles/defaults as an automatic repair. Match libpq backup profiles to these validated identities privately. Verify the production PostgreSQL version separately before selecting dump/restore tools.

## 4. Backup, isolated restore and preservation manifest

After the barrier/drain gates, optionally create a named Neon snapshot if available; never reset production or delete a previous checkpoint to make quota. The mandatory independent backup uses the validated direct maintenance profile. `--list` is inspection only; actual restore is required. No plaintext dump to stdout, no backups in the repository, no `--clean` or `--create` restore option.

Create an integrity-manifest SQL file in the private release directory. It emits counts and aggregate row digests, not raw customer/session/password data. Keep the manifest private as well. UTC avoids timestamp-format differences; use compatible database versions. Exclude only the migration ledger so its approved 008 addition can be checked separately.

```powershell
$ManifestSql = @'
BEGIN READ ONLY;
SET LOCAL TIME ZONE 'UTC';
SELECT format($fmt$SELECT %L,count(*),md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM public.%I t;$fmt$,tablename,tablename)
FROM pg_tables WHERE schemaname='public' AND tablename<>'schema_migrations'
ORDER BY tablename
\gexec
ROLLBACK;
'@
$ManifestPath = Join-Path $ReleaseDir 'preservation.sql'
[IO.File]::WriteAllText($ManifestPath,$ManifestSql,[Text.UTF8Encoding]::new($false))
$Before = @(psql -X -qAt --no-password --set=ON_ERROR_STOP=1 --dbname='service=fq_prod_maintenance' --file="$ManifestPath")
if ($LASTEXITCODE -ne 0) { throw 'Manifest failed' }
$Before | Set-Content -LiteralPath (Join-Path $ReleaseDir 'before-manifest.txt')
$Dump = Join-Path $ReleaseDir ('before-008-' + (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ') + '.dump')
pg_dump --no-password --format=custom --file="$Dump" --dbname='service=fq_prod_maintenance'
if ($LASTEXITCODE -ne 0) { throw 'Backup failed' }
pg_restore --list "$Dump" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Archive inspection failed' }
Get-FileHash -Algorithm SHA256 -LiteralPath "$Dump"

$Local = psql -X -qAt --no-password --set=ON_ERROR_STOP=1 --dbname='service=fq_restore_admin' -c "SELECT inet_server_addr() IN ('127.0.0.1'::inet,'::1'::inet)"
if ($LASTEXITCODE -ne 0 -or $Local.Trim() -ne 't') { throw 'Restore admin must be verified loopback' }
$RestoreDb = 'forgequote_restore_008_' + [guid]::NewGuid().ToString('N') + '_test'
createdb --no-password --maintenance-db='service=fq_restore_admin' "$RestoreDb"
if ($LASTEXITCODE -ne 0) { throw 'Isolated database creation failed' }
pg_restore --no-password --exit-on-error --single-transaction --no-owner --no-privileges --dbname="service=fq_restore_admin dbname=$RestoreDb" "$Dump"
if ($LASTEXITCODE -ne 0) { throw 'Restore test failed' }
$Restored = @(psql -X -qAt --no-password --set=ON_ERROR_STOP=1 --dbname="service=fq_restore_admin dbname=$RestoreDb" --file="$ManifestPath")
if ($LASTEXITCODE -ne 0) { throw 'Restore manifest failed' }
if (Compare-Object -ReferenceObject $Before -DifferenceObject $Restored) { throw 'Restore differs from backup source' }
```

Also compare restored migration ledger/checksums and inspect the Won-before-later-Version-3 history, immutable financial snapshots and eligible PDF outputs on the isolated copy. Use the reviewed local procedure/regression suite against disposable targets, never seed production or generate test RFQs there. `--no-owner --no-privileges` is for this isolated data-restore test; it does not claim a production ACL reconstruction. The archive retains ownership/grant information; production runtime ACLs are checked separately below. Any restore incompatibility blocks release; never ignore restore errors or weaken checks.

## 5. Apply 008 and narrow grants, still in maintenance

Reconfirm actual deployment/true flag/new health path, completed old-process termination, stopped external writers and successful backup restore. Re-run the phase-007 verification immediately before mutation. Do not run an application server with the operator credentials.

```powershell
$VerifyTarget | node "--env-file=$OperatorEnv" --input-type=module - 007
if ($LASTEXITCODE -ne 0) { throw 'Drain/identity changed' }
# Equivalent to db:prepare-cloud; includes checksum migration runner and narrow grants.
node "--env-file=$OperatorEnv" apps/api/scripts/prepare-cloud.js
if ($LASTEXITCODE -ne 0) { throw 'Preparation failed: retain maintenance' }
node "--env-file=$OperatorEnv" apps/api/scripts/check-cloud-permissions.js
if ($LASTEXITCODE -ne 0) { throw 'Permission check failed: retain maintenance' }
$VerifyTarget | node "--env-file=$OperatorEnv" --input-type=module - 008
if ($LASTEXITCODE -ne 0) { throw 'Post-migration verification failed' }
$After = @(psql -X -qAt --no-password --set=ON_ERROR_STOP=1 --dbname='service=fq_prod_maintenance' --file="$ManifestPath")
if ($LASTEXITCODE -ne 0) { throw 'Post-migration manifest failed' }
if (Compare-Object -ReferenceObject $Before -DifferenceObject $After) { throw 'Historical rows changed: retain maintenance' }
```

Expected pending migration list is exactly `008_terminal_rfq_quotation_guards.sql`; 001–007 unchanged. Strict inventory is 18 tables, eight required functions and 35 enabled triggers. No new table/column grant, seed or ownership repair. In maintenance, `/api/health/ready` remains 503 even after migration; the direct operator checks establish database readiness. Existing prepared requests/receipts and archived data must remain intact.

## 6. Exact release and explicit reopening — manual Render

1. While true remains set, if another application replacement is needed, Manual Deploy the same approved `$ReleaseCommit`; verify maintenance mode, exact commit, gate and old-instance termination again. Any failure retains maintenance; do not choose an older writable artifact.
2. Before reopening, verify the full local/restore rehearsal passed, DB checks/manifest passed, current health path is `/api/health/deploy`, true-mode current instance is healthy, and no deploy/rollback is queued. Record approval to reopen. There is no authenticated HTTP bypass for pre-reopening production workflow tests.
3. Set `MAINTENANCE_MODE=false` with **Save only**, then Manual Deploy → Deploy a specific commit → the same `$ReleaseCommit`. No implicit Resume/Restart/latest-commit shortcut.
4. Render must keep routing to the existing maintenance instance until the normal candidate's deployment health passes strict schema 008 readiness. A failed build/start/health must leave that maintenance instance in place. Verify actual behavior; uncertainty is a blocker, not permission to change the health path.
5. A successful normal deployment is the explicit reopening event. Check the exact commit/config, both `/api/health/deploy` and `/api/health/ready` returning ready/current, and liveness 200. Verify both-role authentication, existing RFQs, closed read-only presentation, historical versions, saved values and eligible PDFs. Login/session writes now resume intentionally. Do not create/approve/issue/change an RFQ merely as a production test. Production rejection or receipt-replay probes need separately scoped approval and known original keys/bodies.
6. Observe errors and request recovery. Users retry the same recorded request after service returns; never discard uncertain keys or clear site storage. Preserve APP_ORIGIN, SESSION_SECRET and auto-deploy Off.

```powershell
$ready = Invoke-RestMethod "$Origin/api/health/ready"
$deploy = Invoke-RestMethod "$Origin/api/health/deploy"
if ($ready.status -ne 'ready' -or $ready.schema -ne 'current' -or $deploy.status -ne 'ready') { throw 'Release not verified' }
if ((Get-ReleaseStatus '/api/health/live') -ne 200) { throw 'Liveness failed' }
```

## 7. Failure and recovery rules

| Failure | Required response |
| --- | --- |
| Initial maintenance build/start fails | Older normal application may still write on 007. No barrier; do not migrate. Diagnose and repeat explicit true-mode deployment. |
| Old process/client termination uncertain | No migration. Obtain positive evidence or stop. Do not infer from new health or elapsed time. |
| Identity/isolation/ledger/backup/restore failure | Retain maintenance; do not alter data/roles/passwords to bypass the gate. |
| Preparation/migration failure | Keep maintenance. Migration DDL and ledger are transactional, but preparation's earlier ACL transaction may already have committed. Inspect ledger privately. Never edit 001–008 or delete a migration receipt. |
| 008 applied but grants fail | Keep maintenance; repair the diagnosed issue with approval, rerun reviewed preparation/checks. An intact 008 is skipped by checksum. Do not disable triggers. |
| 008 applied but application deploy fails | The currently live maintenance instance must remain. Restore desired flag true using Save only if a failed candidate left desired false, and explicitly deploy the reviewed capability commit if needed. No automatic database restore/downgrade. |
| Normal-mode deployment before 008 | Deployment health must fail; retain the current maintenance instance. Do not switch health back to liveness to make it pass. |
| Attempted old-commit manual deployment | Under the current deployment path, a pre-capability build must return 404 and fail. Stop; do not bypass the gate. |
| Post-reopening incident | Do not begin another DB operation while writers may be live. Reestablish and verify maintenance/drain first. Immediate emergency suspension may stop traffic, but resume is not a verified release procedure. |
| Disaster restore | Separately authorized, offline recovery only. Restore to an isolated target; apply 008 and grants/checks before exposing any application. Never serve an old writable release against a restored 007 schema. Preserve receipt/snapshot consistency; assess writes since backup before any production restore. |

**Do not use Render Rollback during the window.** It reuses the target deployment's health path AND environment, so an old snapshot can undo both barriers. Use an explicit exact-commit manual deployment with verified current settings. Do not disable auto-deploy safeguards, reset Neon production history, rotate secrets, change domains/APP_ORIGIN or restore a pre-008 database as an application rollback.

If any actual provider condition disagrees with this tested protocol, keep production changes stopped and return for owner review. The code cannot enforce policy against privileged Render/SQL operators; no claim of a distributed database write fence is made.

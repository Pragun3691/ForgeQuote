# T07 - Local deployment checkpoint

Existing feature/T07-cloud-deployment at b19a86d contained exactly six uncommitted deployment changes. Owner approved finishing those changes plus relevant docs/tests/credential cleanup; latest instruction explicitly forbids further Neon/Render access, credentials requests, push, merge and deployment. Those boundaries were respected on resume.

## Manifest and behavior

- render.yaml: main branch; pinned existing Node/build/start/free-plan/health settings; existing approved server Gemini model/timeout defaults. No key embedded.
- apps/api/src/server.js: explicit 0.0.0.0 bind at configured platform PORT.
- apps/api/src/cloud-database.js: neondb target allowance and additional exact confirmed direct Neon host/port guard; strict ownership/ACL checker unchanged.
- apps/api/scripts/prepare-cloud.js and check-cloud-permissions.js: use connection guard before connection.
- apps/api/test/deployment.test.js: main/model manifest and direct-neondb target regressions.
- .env.example: maintenance-only CLOUD_DATABASE_HOST name.
- README.md, docs/deployment.md, docs/current-status.md, docs/learning-log.md, tasks/T07-cloud-deployment.md, ADR-0013 and this handoff: current contract, evidence and scope.

No endpoint, schema, grant, financial formula/golden, dependency, approval/PDF or unrelated UI change. No public URL exists in this handoff. Required runtime configuration and exact build/start commands are in docs/deployment.md; maintenance/test/demo-seed credentials must never enter Render.

## Verified results

The previously interrupted regression job completed successfully: npm.cmd test 78/78; test:costing 33/33; test:db 104/104; all six Chrome scripts; check:api 40 modules; test:production 1/1. Its disposable database fixtures and parent were removed. All nine financial goldens remain unchanged. Final local production build, unit rerun 78/78, syntax check and production startup passed. No cloud calls or live Gemini calls were needed on resume.

Earlier authorized Neon provisioning completed migrations 001-005, synthetic spindle/rates/users and strict runtime verification (16 tables/four functions plus expected trigger/ACL checks). This resume relies on that completed evidence and the owner's confirmation, rather than accessing Neon again. Public health/readiness, secure cookie/Origin/CSRF through Render, sign-in, register, RFQ/two-part quotation create/reopen, deployed asset scanning and production Gemini remain unverified.

## Credential cleanup and remaining limits

Removed temporary plaintext/encrypted owner handoffs and cloud helper scripts from .tmp. The sole runtime/demo/session handoff was safely moved to ignored .env.cloud-secrets.dpapi without overwriting an existing vault; its maintenance URL had already been removed. Windows DPAPI encryption is retained, no secret was printed, and credential/cached dashboard session variables were cleared. No database credential was reset during cleanup. The earlier owner-credential exposure was reported; private reset confirmation is not verified here and deletion cannot retract disclosure. The durable vault must remain private and outside Git/uploads.

Main must contain the reviewed commit before an owner-directed deployment. Remote-main access and actual Render environment values are not verified. No push, merge, deployment or cloud reconnection occurred. STOP after commit.

1. Why does runtime use forgequote_app rather than neondb_owner?
2. Why must APP_ORIGIN match the exact public HTTPS origin while TRUST_PROXY_HOPS is explicitly bounded?
3. Why does liveness 200 not prove database readiness, correct runtime privileges or live Gemini availability?

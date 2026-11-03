# ADR-0013 - Explicit Neon default database deployment target

- Status: ACCEPTED under the owner's T07 deployment/configuration authorization, 2026-11-03.
- Extends ADR-0007's dedicated forgequote_* name convention for the explicitly supplied fresh Neon neondb only. No ownership or privilege-check exception.

Neon supplied project forgequote-demo / production / neondb with neondb_owner maintenance ownership. Cloud CLIs accept this database name only with CLOUD_DATABASE_HOST exactly matching a direct *.neon.tech URL on port 5432; pooled/local/mismatched endpoints are rejected. Existing protected local names remain forbidden. The maintenance/runtime URLs must still share host/port/database and differ in role.

All existing maintenance-owner, runtime direct-login, no-membership/elevated-power, no-runtime-ownership, exact ACL, trigger/function/domain/inventory checks remain. No migration or runtime-grants source changes. Provisioning was completed before the local-only resume; no cloud was contacted during that resume.

render.yaml targets main with auto-deploy off. Express binds 0.0.0.0 at the platform PORT and serves the existing React build/API together. No security controls, formulas, financial policy, provider/model or routing behavior changed. Actual public Render/HTTPS/Gemini checks remain unverified.

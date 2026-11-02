# Risk register

| Risk | Preventive action | Fallback |
|---|---|---|
| Late integration/deploy | Deploy minimal frontend/API/Postgres from first slice; smoke test daily | Keep fewer screens and stable core |
| Arithmetic inconsistency | Independently specified golden cases, fixed decimal rounding | Block quote issue if failing tests |
| AI hallucinations/confidentiality | Synthetic fixtures, verified snippets, human confirmation, provider terms check | Manual entry; report extraction failure honestly |
| Rate gaps/overlaps | DB constraint or transactional protection, boundary tests | Refuse pricing and show clear error |
| Quote edits after approval | Immutable quote versions, server checks | Create revision; invalidate old pending approval |
| Time overrun | Finish core before extras; feature freeze Nov 6 target, Nov 8 contingency | Omit optional import/routing search |
| Interview inability to defend code | Learning log, predictions before coding, demo and 3 Qs per task | Spend time tracing each API and decision |
| Existing local runtime ownership | Preserve it per M8 instruction; never deploy those credentials; fresh cloud owner/runtime separation and strict checks | Stop cloud release if isolation fails; no broad local ownership repair |
| Free-tier cold start/quota suspension | Render Free + Neon Free; DB-free liveness, separate readiness, quota/retention records; no artificial keep-alive | Explain cold start/retry; any paid change requires approval |
| Privileged cloud credentials accidentally used | SQL-created runtime, no memberships/ownership, direct LOGIN check; production excludes maintenance/test/seed environment | Stop before public access; fix configuration and rerun strict checker |
| TLS downgrade or secret logging | Explicit verified TLS; normalize URL SSL options; allowlist request logs and test malformed/oversize input | Reject insecure startup/connection; no certificate bypass |
| Retry abuse or ambiguous save outcome | Process-local quote limiter and transactional submission keys; 429/network errors retain pending key/body | Explicit same-key retry, never silently generate another key |
| Unverified historical restore | Fresh seeds only now; review/rehearse xid-based assembly guards before cross-cluster imports/recovery | Retain original history; no destructive restore/reset fallback |

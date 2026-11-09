# Free maintenance and release safety

Owner approved implementation on `feature/free-maintenance-safety` from accepted main `eec0e833fdc0c795475547a3b8473bbcbfe75167`.

Implement strict explicit maintenance, 503/no-store/Retry-After responses before writers, no session store or application pool in maintenance, separate liveness/readiness/deployment health and a schema-007-to-008 Render Free protocol. Never equate environment updates or new health with termination of old writers. Uncertainty about provider routing/termination is a production blocker.

Preserve 001–008, historical records, financial rules/goldens, role/auth/session/CSRF/idempotency/PDF behavior. Add no paid service, dependency, database control plane or bypass token.

Verify all request methods/alternate routes, no scheduled writes, actual process startup/shutdown, overlapping old transactions, explicit drain, failed activation/deactivation/deployment, migration rollback/retry, preserved sessions and exact recovery, browser notices and all existing regressions. Use only guarded disposable local databases and instances.

Produce ADR 0029, an exact release/recovery runbook and a detailed handoff with files/evidence/limits. Do not connect to production, change Render/Neon/environment settings, modify development data, commit, push, merge or deploy. Stop for owner review.

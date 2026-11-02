-- Explicit local maintenance operation, not an automatic schema migration.
-- No ownership change and no grants on ALL TABLES. Re-run when reviewing runtime scope.
BEGIN;
REVOKE ALL PRIVILEGES ON TABLE public.rate_keys, public.rate_versions, public.rfqs,
  public.rfq_parts, public.routing_revisions, public.schema_migrations,
  public.rate_periods, public.users, public.sessions FROM forgequote_app;
GRANT SELECT ON TABLE public.rate_keys, public.rate_versions, public.rfqs,
  public.rfq_parts, public.routing_revisions, public.schema_migrations,
  public.rate_periods, public.users TO forgequote_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sessions TO forgequote_app;
COMMIT;

-- Explicit local maintenance operation, not an automatic schema migration.
-- No ownership change and no grants on ALL TABLES. Re-run when reviewing runtime scope.
BEGIN;
REVOKE ALL PRIVILEGES ON TABLE public.rate_keys, public.rate_versions, public.rfqs,
  public.rfq_parts, public.routing_revisions, public.schema_migrations,
  public.rate_periods, public.users, public.sessions, public.quotations,
  public.quotation_versions, public.quotation_parts, public.quotation_rates,
  public.quotation_part_tiers, public.quotation_totals, public.draft_submissions, public.rfq_submissions FROM forgequote_app;
GRANT SELECT ON TABLE public.rate_keys, public.rate_versions, public.rfqs,
  public.rfq_parts, public.routing_revisions, public.schema_migrations,
  public.rate_periods, public.users TO forgequote_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sessions TO forgequote_app;
GRANT SELECT, INSERT ON TABLE public.quotation_parts,
  public.quotation_rates, public.quotation_part_tiers, public.quotation_totals TO forgequote_app;
GRANT SELECT ON TABLE public.quotation_versions TO forgequote_app;
GRANT SELECT ON TABLE public.quotations TO forgequote_app;
GRANT INSERT (id,rfq_id) ON public.quotations TO forgequote_app;
-- Do not allow callers to forge creation_xid or the decision timestamp.
GRANT INSERT (id,quotation_id,version_number,pricing_date,formula_version,currency,
  gst_percent,created_by,rfq_snapshot,annual_value_ex_gst) ON public.quotation_versions TO forgequote_app;
GRANT UPDATE (next_version) ON public.quotations TO forgequote_app;
GRANT SELECT ON public.draft_submissions TO forgequote_app;
GRANT INSERT (actor_user_id,submission_key,request_fingerprint,rfq_id,version_id) ON public.draft_submissions TO forgequote_app;
GRANT INSERT (id,reference,customer_name,due_date,owner_label) ON public.rfqs TO forgequote_app;
GRANT INSERT (id,rfq_id,part_number,description,gross_weight_kg,requested_annual_qty,
  material_rate_key_id,scrap_rate_key_id,overhead_rate_key_id,packaging_rate_key_id,freight_rate_key_id) ON public.rfq_parts TO forgequote_app;
GRANT INSERT (id,part_id,revision_number,machine_rate_key_id,cycle_time_min,setup_hours_per_batch) ON public.routing_revisions TO forgequote_app;
GRANT SELECT ON public.rfq_submissions TO forgequote_app;
GRANT INSERT (actor_user_id,submission_key,request_fingerprint,rfq_id) ON public.rfq_submissions TO forgequote_app;
COMMIT;

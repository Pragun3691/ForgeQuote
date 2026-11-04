CREATE TABLE quotation_events (
  version_id UUID NOT NULL REFERENCES quotation_versions(id),
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 3),
  event_type TEXT NOT NULL CHECK (event_type IN ('submitted','auto_approved','approved','rejected','issued')),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  reason TEXT,
  submission_key UUID,
  quotation_number TEXT UNIQUE,
  PRIMARY KEY (version_id, position),
  UNIQUE (version_id, event_type),
  UNIQUE (actor_user_id, submission_key),
  CHECK ((event_type='rejected' AND reason IS NOT NULL AND length(btrim(reason)) BETWEEN 1 AND 1000) OR
         (event_type<>'rejected' AND reason IS NULL)),
  CHECK ((event_type='auto_approved' AND submission_key IS NULL) OR
         (event_type<>'auto_approved' AND submission_key IS NOT NULL)),
  CHECK ((event_type='issued' AND quotation_number IS NOT NULL AND quotation_number='FQ-' || version_id::text) OR
         (event_type<>'issued' AND quotation_number IS NULL))
);
CREATE UNIQUE INDEX quotation_one_decision ON quotation_events(version_id)
  WHERE event_type IN ('auto_approved','approved','rejected');
CREATE TRIGGER quotation_events_immutable BEFORE UPDATE OR DELETE ON quotation_events
  FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER quotation_events_no_truncate BEFORE TRUNCATE ON quotation_events
  FOR EACH STATEMENT EXECUTE FUNCTION reject_history_mutation();

-- Shares the existing version-allocation lock; no snapshot is updated.
CREATE FUNCTION guard_quotation_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v quotation_versions%ROWTYPE; h quotations%ROWTYPE; previous TEXT; actor_role TEXT;
BEGIN
  SELECT * INTO v FROM quotation_versions WHERE id=NEW.version_id;
  SELECT * INTO h FROM quotations WHERE id=v.quotation_id FOR UPDATE;
  IF v.version_number <> h.next_version-1 THEN
    RAISE EXCEPTION 'Stale quotation version' USING ERRCODE='55000';
  END IF;
  SELECT role INTO actor_role FROM users WHERE id=NEW.actor_user_id AND active;
  IF actor_role IS NULL OR actor_role <> (CASE WHEN NEW.event_type IN ('approved','rejected')
      THEN 'sales_head' ELSE 'estimator' END) THEN
    RAISE EXCEPTION 'Lifecycle role forbidden' USING ERRCODE='42501';
  END IF;
  SELECT event_type INTO previous FROM quotation_events WHERE version_id=NEW.version_id ORDER BY position DESC LIMIT 1;
  IF NOT COALESCE((NEW.event_type='submitted' AND previous IS NULL AND NEW.position=1) OR
      (NEW.event_type='auto_approved' AND previous='submitted' AND NEW.position=2 AND v.annual_value_ex_gst<=2500000) OR
      (NEW.event_type IN ('approved','rejected') AND previous='submitted' AND NEW.position=2 AND v.annual_value_ex_gst>2500000) OR
      (NEW.event_type='issued' AND previous IN ('approved','auto_approved') AND NEW.position=3),false) THEN
    RAISE EXCEPTION 'Invalid lifecycle transition' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER quotation_events_transition BEFORE INSERT ON quotation_events
  FOR EACH ROW EXECUTE FUNCTION guard_quotation_event();

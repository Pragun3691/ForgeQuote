-- Prospective enforcement only: no historical rows or snapshots are rewritten.
-- All RFQ quotation writes and closure acquire the quotation header row first.
-- Replace the former outcome-only advisory lock to avoid inverted lock orders
-- between API writes and direct restricted-runtime SQL.
CREATE OR REPLACE FUNCTION guard_quote_header() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Each check must see a closure committed while waiting for the row lock.
  -- PostgreSQL retains older snapshots at higher isolation levels; reject those
  -- direct SQL writes rather than allow an invisible terminal outcome.
  IF current_setting('transaction_isolation') NOT IN ('read committed','read uncommitted') THEN
    RAISE EXCEPTION 'Quotation writes and RFQ closure require READ COMMITTED isolation' USING ERRCODE='25000';
  END IF;
  IF NEW.id <> OLD.id OR NEW.rfq_id <> OLD.rfq_id OR NEW.next_version <> OLD.next_version + 1 THEN
    RAISE EXCEPTION 'Only atomic version allocation may update quotation headers' USING ERRCODE = '55000';
  END IF;
  IF EXISTS (SELECT 1 FROM rfq_outcomes WHERE rfq_id=OLD.rfq_id) THEN
    RAISE EXCEPTION 'RFQ is terminal; quotation allocation is closed' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION guard_quotation_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_rfq UUID;
BEGIN
  -- Each check must see a closure committed while waiting for the row lock.
  -- PostgreSQL retains older snapshots at higher isolation levels; reject those
  -- direct SQL writes rather than allow an invisible terminal outcome.
  IF current_setting('transaction_isolation') NOT IN ('read committed','read uncommitted') THEN
    RAISE EXCEPTION 'Quotation writes and RFQ closure require READ COMMITTED isolation' USING ERRCODE='25000';
  END IF;
  SELECT rfq_id INTO parent_rfq FROM quotations WHERE id=NEW.quotation_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM rfq_outcomes WHERE rfq_id=parent_rfq) THEN
    RAISE EXCEPTION 'RFQ is terminal; new quotation versions are closed' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER quotation_version_terminal BEFORE INSERT ON quotation_versions
  FOR EACH ROW EXECUTE FUNCTION guard_quotation_version();

CREATE OR REPLACE FUNCTION guard_quotation_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v quotation_versions%ROWTYPE; h quotations%ROWTYPE; previous TEXT; actor_role TEXT;
BEGIN
  -- Each check must see a closure committed while waiting for the row lock.
  -- PostgreSQL retains older snapshots at higher isolation levels; reject those
  -- direct SQL writes rather than allow an invisible terminal outcome.
  IF current_setting('transaction_isolation') NOT IN ('read committed','read uncommitted') THEN
    RAISE EXCEPTION 'Quotation writes and RFQ closure require READ COMMITTED isolation' USING ERRCODE='25000';
  END IF;
  SELECT * INTO v FROM quotation_versions WHERE id=NEW.version_id;
  SELECT * INTO h FROM quotations WHERE id=v.quotation_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM rfq_outcomes WHERE rfq_id=h.rfq_id) THEN
    RAISE EXCEPTION 'RFQ is terminal; quotation transitions are closed' USING ERRCODE='55000';
  END IF;
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

CREATE OR REPLACE FUNCTION guard_rfq_outcome() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Each check must see a closure committed while waiting for the row lock.
  -- PostgreSQL retains older snapshots at higher isolation levels; reject those
  -- direct SQL writes rather than allow an invisible terminal outcome.
  IF current_setting('transaction_isolation') NOT IN ('read committed','read uncommitted') THEN
    RAISE EXCEPTION 'Quotation writes and RFQ closure require READ COMMITTED isolation' USING ERRCODE='25000';
  END IF;
  PERFORM 1 FROM quotations WHERE rfq_id=NEW.rfq_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.actor_user_id AND active AND role='sales_head') THEN
    RAISE EXCEPTION 'Sales Head required' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM quotations q JOIN quotation_versions v ON v.quotation_id=q.id
    JOIN quotation_events e ON e.version_id=v.id WHERE q.rfq_id=NEW.rfq_id AND e.event_type='issued') THEN
    RAISE EXCEPTION 'Only sent RFQs may receive an outcome' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;

-- Existing rows and quotation snapshots remain untouched. New runtime rates
-- take raw text so validation precedes NUMERIC(18,6) coercion.
ALTER TABLE rate_versions
  ADD COLUMN raw_value TEXT,
  ADD COLUMN actor_user_id UUID REFERENCES users(id),
  ADD COLUMN reason TEXT,
  ADD COLUMN submission_key UUID,
  ADD CONSTRAINT rate_author_request UNIQUE(actor_user_id,submission_key),
  ADD CONSTRAINT rate_author_complete CHECK (
    (actor_user_id IS NULL AND raw_value IS NULL AND reason IS NULL AND submission_key IS NULL) OR
    (actor_user_id IS NOT NULL AND raw_value IS NOT NULL AND reason IS NOT NULL AND submission_key IS NOT NULL
      AND raw_value ~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$'
      AND length(btrim(reason)) BETWEEN 1 AND 1000 AND reason !~ '[[:cntrl:]]'));

CREATE FUNCTION guard_rate_authoring() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest DATE;
BEGIN
  -- Trusted maintenance retains legacy seed/import insertion. Runtime cannot
  -- omit provenance; neither path permits mutation of historical rows.
  IF NEW.actor_user_id IS NULL THEN
    IF current_user <> (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=TG_RELID) THEN
      RAISE EXCEPTION 'Rate author required' USING ERRCODE='42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.actor_user_id AND active AND role='sales_head') THEN
    RAISE EXCEPTION 'Sales Head required' USING ERRCODE='42501';
  END IF;
  IF NEW.raw_value IS NULL OR NEW.raw_value !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$' THEN
    RAISE EXCEPTION 'Invalid rate precision' USING ERRCODE='23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('rate-key:' || NEW.rate_key_id::text,0));
  SELECT max(effective_from) INTO latest FROM rate_versions WHERE rate_key_id=NEW.rate_key_id;
  IF NEW.effective_from < (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date
    OR NEW.effective_from <= latest THEN
    RAISE EXCEPTION 'Rate start must advance history and not be in the past' USING ERRCODE='23514';
  END IF;
  NEW.value := NEW.raw_value::numeric;
  RETURN NEW;
END;
$$;
CREATE TRIGGER rate_authoring BEFORE INSERT ON rate_versions FOR EACH ROW EXECUTE FUNCTION guard_rate_authoring();

CREATE TABLE rfq_outcomes (
  rfq_id UUID PRIMARY KEY REFERENCES rfqs(id),
  outcome TEXT NOT NULL CHECK (outcome IN ('won','lost')),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  reason TEXT,
  submission_key UUID NOT NULL,
  UNIQUE(actor_user_id,submission_key),
  CHECK ((outcome='lost' AND reason IS NOT NULL AND length(btrim(reason)) BETWEEN 1 AND 1000 AND reason !~ '[[:cntrl:]]')
    OR (outcome='won' AND reason IS NULL))
);
CREATE FUNCTION guard_rfq_outcome() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('rfq-outcome:' || NEW.rfq_id::text,0));
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
CREATE TRIGGER rfq_outcome_transition BEFORE INSERT ON rfq_outcomes FOR EACH ROW EXECUTE FUNCTION guard_rfq_outcome();
CREATE TRIGGER rfq_outcomes_immutable BEFORE UPDATE OR DELETE ON rfq_outcomes FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER rfq_outcomes_no_truncate BEFORE TRUNCATE ON rfq_outcomes FOR EACH STATEMENT EXECUTE FUNCTION reject_history_mutation();

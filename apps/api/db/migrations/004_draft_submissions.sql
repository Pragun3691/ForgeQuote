CREATE TABLE draft_submissions (
  actor_user_id UUID NOT NULL REFERENCES users(id),
  submission_key UUID NOT NULL,
  request_fingerprint TEXT NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  rfq_id UUID NOT NULL REFERENCES rfqs(id),
  version_id UUID PRIMARY KEY REFERENCES quotation_versions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (actor_user_id, submission_key)
);

CREATE FUNCTION guard_draft_submission() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM quotation_versions v JOIN quotations q ON q.id=v.quotation_id
    WHERE v.id=NEW.version_id AND v.created_by=NEW.actor_user_id AND q.rfq_id=NEW.rfq_id
      AND v.creation_xid=pg_current_xact_id()) THEN
    RAISE EXCEPTION 'Submission must belong to a version created in this transaction' USING ERRCODE='23503';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER draft_submission_assembly BEFORE INSERT ON draft_submissions
  FOR EACH ROW EXECUTE FUNCTION guard_draft_submission();
CREATE TRIGGER draft_submissions_immutable BEFORE UPDATE OR DELETE ON draft_submissions
  FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER draft_submissions_no_truncate BEFORE TRUNCATE ON draft_submissions
  FOR EACH STATEMENT EXECUTE FUNCTION reject_history_mutation();

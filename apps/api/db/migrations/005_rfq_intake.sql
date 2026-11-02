CREATE TABLE rfq_submissions (
  actor_user_id UUID NOT NULL REFERENCES users(id),
  submission_key UUID NOT NULL,
  request_fingerprint TEXT NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  rfq_id UUID NOT NULL UNIQUE REFERENCES rfqs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (actor_user_id, submission_key)
);
CREATE TRIGGER rfq_submissions_immutable BEFORE UPDATE OR DELETE ON rfq_submissions
FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER rfq_submissions_no_truncate BEFORE TRUNCATE ON rfq_submissions
FOR EACH STATEMENT EXECUTE FUNCTION reject_history_mutation();

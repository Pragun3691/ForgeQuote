CREATE TABLE rate_keys (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('material','machine','scrap','overhead','packaging','freight')),
  unit TEXT NOT NULL,
  UNIQUE (id, category),
  CHECK ((category = 'material' AND unit = 'INR/kg') OR
         (category = 'machine' AND unit = 'INR/hour') OR
         (category IN ('scrap','overhead') AND unit = 'percent') OR
         (category IN ('packaging','freight') AND unit = 'INR/piece'))
);

CREATE TABLE rate_versions (
  id UUID PRIMARY KEY,
  rate_key_id UUID NOT NULL REFERENCES rate_keys(id) ON DELETE RESTRICT,
  effective_from DATE NOT NULL CHECK (isfinite(effective_from)),
  value NUMERIC(18,6) NOT NULL CHECK (value >= 0 AND value <> 'NaN'::numeric),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rate_key_id, effective_from)
);

CREATE VIEW rate_periods AS
SELECT id, rate_key_id, value, effective_from,
       lead(effective_from) OVER (PARTITION BY rate_key_id ORDER BY effective_from) AS effective_to
FROM rate_versions;

CREATE TABLE rfqs (
  id UUID PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  due_date DATE NOT NULL CHECK (isfinite(due_date)),
  owner_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rfq_parts (
  id UUID PRIMARY KEY,
  rfq_id UUID NOT NULL REFERENCES rfqs(id) ON DELETE RESTRICT,
  part_number TEXT NOT NULL,
  description TEXT NOT NULL,
  gross_weight_kg NUMERIC(18,6) NOT NULL CHECK (gross_weight_kg >= 0 AND gross_weight_kg <> 'NaN'::numeric),
  requested_annual_qty BIGINT NOT NULL CHECK (requested_annual_qty BETWEEN 1 AND 1000000000),
  material_rate_key_id UUID NOT NULL,
  material_category TEXT NOT NULL DEFAULT 'material' CHECK (material_category = 'material'),
  scrap_rate_key_id UUID NOT NULL,
  scrap_category TEXT NOT NULL DEFAULT 'scrap' CHECK (scrap_category = 'scrap'),
  overhead_rate_key_id UUID NOT NULL,
  overhead_category TEXT NOT NULL DEFAULT 'overhead' CHECK (overhead_category = 'overhead'),
  packaging_rate_key_id UUID NOT NULL,
  packaging_category TEXT NOT NULL DEFAULT 'packaging' CHECK (packaging_category = 'packaging'),
  freight_rate_key_id UUID NOT NULL,
  freight_category TEXT NOT NULL DEFAULT 'freight' CHECK (freight_category = 'freight'),
  FOREIGN KEY (material_rate_key_id, material_category) REFERENCES rate_keys(id, category),
  FOREIGN KEY (scrap_rate_key_id, scrap_category) REFERENCES rate_keys(id, category),
  FOREIGN KEY (overhead_rate_key_id, overhead_category) REFERENCES rate_keys(id, category),
  FOREIGN KEY (packaging_rate_key_id, packaging_category) REFERENCES rate_keys(id, category),
  FOREIGN KEY (freight_rate_key_id, freight_category) REFERENCES rate_keys(id, category),
  UNIQUE (rfq_id, part_number)
);

CREATE TABLE routing_revisions (
  id UUID PRIMARY KEY,
  part_id UUID NOT NULL REFERENCES rfq_parts(id) ON DELETE RESTRICT,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  machine_rate_key_id UUID NOT NULL,
  machine_category TEXT NOT NULL DEFAULT 'machine' CHECK (machine_category = 'machine'),
  cycle_time_min NUMERIC(18,6) NOT NULL CHECK (cycle_time_min >= 0 AND cycle_time_min <> 'NaN'::numeric),
  setup_hours_per_batch NUMERIC(18,6) NOT NULL CHECK (setup_hours_per_batch >= 0 AND setup_hours_per_batch <> 'NaN'::numeric),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (part_id, revision_number),
  FOREIGN KEY (machine_rate_key_id, machine_category) REFERENCES rate_keys(id, category)
);

CREATE FUNCTION reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; insert a new version', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER rate_versions_immutable BEFORE UPDATE OR DELETE ON rate_versions
FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER rate_versions_no_truncate BEFORE TRUNCATE ON rate_versions
FOR EACH STATEMENT EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER routing_revisions_immutable BEFORE UPDATE OR DELETE ON routing_revisions
FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER routing_revisions_no_truncate BEFORE TRUNCATE ON routing_revisions
FOR EACH STATEMENT EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER rate_keys_immutable BEFORE UPDATE OR DELETE ON rate_keys
FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

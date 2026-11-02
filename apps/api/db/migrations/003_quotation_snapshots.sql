-- Output amounts deliberately use unconstrained NUMERIC: engine results can be
-- much larger than raw NUMERIC(18,6) inputs. Never round a value on storage.
CREATE DOMAIN quote_amount AS NUMERIC
  CHECK (VALUE >= 0 AND VALUE < 'Infinity'::numeric AND VALUE = trunc(VALUE, 2));

CREATE TABLE quotations (
  id UUID PRIMARY KEY,
  rfq_id UUID NOT NULL UNIQUE REFERENCES rfqs(id),
  next_version BIGINT NOT NULL DEFAULT 1 CHECK (next_version > 0)
);
CREATE TABLE quotation_versions (
  id UUID PRIMARY KEY,
  quotation_id UUID NOT NULL REFERENCES quotations(id),
  version_number BIGINT NOT NULL CHECK (version_number > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status = 'draft'),
  pricing_date DATE NOT NULL CHECK (isfinite(pricing_date)),
  formula_version TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency = 'INR'),
  gst_percent NUMERIC(18,6) NOT NULL CHECK (gst_percent >= 0 AND gst_percent <> 'NaN'::numeric),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  creation_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
  rfq_snapshot JSONB NOT NULL CHECK (jsonb_typeof(rfq_snapshot) = 'object'),
  annual_value_ex_gst quote_amount NOT NULL,
  UNIQUE (quotation_id, version_number)
);
CREATE TABLE quotation_parts (
  id UUID PRIMARY KEY,
  version_id UUID NOT NULL REFERENCES quotation_versions(id),
  part_id UUID NOT NULL REFERENCES rfq_parts(id),
  routing_revision_id UUID NOT NULL REFERENCES routing_revisions(id),
  part_snapshot JSONB NOT NULL CHECK (jsonb_typeof(part_snapshot) = 'object'),
  routing_snapshot JSONB NOT NULL CHECK (jsonb_typeof(routing_snapshot) = 'object'),
  input_snapshot JSONB NOT NULL CHECK (jsonb_typeof(input_snapshot) = 'object'),
  annual_value_ex_gst quote_amount NOT NULL,
  UNIQUE (version_id, part_id),
  UNIQUE (id, version_id)
);
CREATE TABLE quotation_rates (
  version_id UUID NOT NULL,
  quotation_part_id UUID NOT NULL,
  field TEXT NOT NULL CHECK (field IN ('materialInrPerKg','machineInrPerHour','scrapPercent','overheadPercent','packagingInrPerPiece','freightInrPerPiece')),
  rate_version_id UUID NOT NULL REFERENCES rate_versions(id),
  rate_key_id UUID NOT NULL REFERENCES rate_keys(id),
  effective_from DATE NOT NULL CHECK (isfinite(effective_from)),
  value NUMERIC(18,6) NOT NULL CHECK (value >= 0 AND value <> 'NaN'::numeric),
  PRIMARY KEY (quotation_part_id, field),
  FOREIGN KEY (quotation_part_id, version_id) REFERENCES quotation_parts(id, version_id)
);
CREATE TABLE quotation_part_tiers (
  version_id UUID NOT NULL,
  quotation_part_id UUID NOT NULL,
  scenario TEXT NOT NULL CHECK (scenario IN ('50','100','150')),
  annual_qty BIGINT NOT NULL CHECK (annual_qty BETWEEN 1 AND 1000000000),
  batch_count BIGINT NOT NULL CHECK (batch_count BETWEEN 1 AND 12 AND batch_count <= annual_qty),
  base_batch_qty BIGINT NOT NULL CHECK (base_batch_qty > 0),
  extra_unit_batch_count BIGINT NOT NULL CHECK (extra_unit_batch_count >= 0 AND extra_unit_batch_count < batch_count),
  material quote_amount NOT NULL, machining quote_amount NOT NULL,
  scrap quote_amount NOT NULL, overhead quote_amount NOT NULL,
  packaging quote_amount NOT NULL, freight quote_amount NOT NULL, setup quote_amount NOT NULL,
  cost_per_unit quote_amount NOT NULL, selling_price_per_unit_ex_gst quote_amount NOT NULL,
  taxable_subtotal quote_amount NOT NULL, gst_amount quote_amount NOT NULL, total_with_gst quote_amount NOT NULL,
  PRIMARY KEY (quotation_part_id, scenario),
  FOREIGN KEY (quotation_part_id, version_id) REFERENCES quotation_parts(id, version_id),
  CHECK (total_with_gst = taxable_subtotal + gst_amount)
);
CREATE TABLE quotation_totals (
  version_id UUID NOT NULL REFERENCES quotation_versions(id),
  scenario TEXT NOT NULL CHECK (scenario IN ('50','100','150')),
  taxable_subtotal quote_amount NOT NULL, gst_amount quote_amount NOT NULL, total_with_gst quote_amount NOT NULL,
  PRIMARY KEY (version_id, scenario),
  CHECK (total_with_gst = taxable_subtotal + gst_amount)
);

-- Children may only be assembled in the transaction that inserts the version.
-- No sealing UPDATE or deferred triggers: COMMIT closes the append window.
CREATE FUNCTION guard_quote_assembly() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM quotation_versions WHERE id = NEW.version_id
                 AND creation_xid = pg_current_xact_id()) THEN
    RAISE EXCEPTION 'Quotation assembly transaction has ended' USING ERRCODE = '55000';
  END IF;
  IF TG_TABLE_NAME = 'quotation_parts' THEN
    IF NOT EXISTS (SELECT 1 FROM rfq_parts p
      JOIN routing_revisions r ON r.part_id = p.id
      JOIN quotation_versions v ON v.id = NEW.version_id
      JOIN quotations q ON q.id = v.quotation_id AND q.rfq_id = p.rfq_id
      WHERE p.id = NEW.part_id AND r.id = NEW.routing_revision_id) THEN
      RAISE EXCEPTION 'Part/routing does not belong to quotation RFQ' USING ERRCODE = '23503';
    END IF;
  ELSIF TG_TABLE_NAME = 'quotation_rates' THEN
    IF NOT EXISTS (SELECT 1 FROM rate_versions r JOIN rate_keys k ON k.id = r.rate_key_id
      WHERE r.id = NEW.rate_version_id AND r.rate_key_id = NEW.rate_key_id
        AND r.value = NEW.value AND r.effective_from = NEW.effective_from
        AND k.category = CASE NEW.field
          WHEN 'materialInrPerKg' THEN 'material' WHEN 'machineInrPerHour' THEN 'machine'
          WHEN 'scrapPercent' THEN 'scrap' WHEN 'overheadPercent' THEN 'overhead'
          WHEN 'packagingInrPerPiece' THEN 'packaging' WHEN 'freightInrPerPiece' THEN 'freight' END) THEN
      RAISE EXCEPTION 'Rate snapshot does not match referenced rate' USING ERRCODE = '23503';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE FUNCTION guard_quote_header() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.rfq_id <> OLD.rfq_id OR NEW.next_version <> OLD.next_version + 1 THEN
    RAISE EXCEPTION 'Only atomic version allocation may update quotation headers' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER quotations_allocate BEFORE UPDATE ON quotations FOR EACH ROW EXECUTE FUNCTION guard_quote_header();
CREATE TRIGGER quotations_no_delete BEFORE DELETE ON quotations FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER quotations_no_truncate BEFORE TRUNCATE ON quotations FOR EACH STATEMENT EXECUTE FUNCTION reject_history_mutation();
DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['quotation_versions','quotation_parts','quotation_rates','quotation_part_tiers','quotation_totals'] LOOP
    EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_history_mutation()', table_name);
    EXECUTE format('CREATE TRIGGER no_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION reject_history_mutation()', table_name);
    IF table_name <> 'quotation_versions' THEN
      EXECUTE format('CREATE TRIGGER assembly_only BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION guard_quote_assembly()', table_name);
    END IF;
  END LOOP;
END;
$$;

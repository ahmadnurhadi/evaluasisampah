CREATE OR REPLACE FUNCTION public.validate_school_relationships()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_data JSONB := to_jsonb(NEW);
  row_school_id UUID;
  row_batch_id UUID;
  row_audit_id UUID;
  row_finding_id UUID;
  row_activity_id UUID;
  row_location_id UUID;
  row_source_id UUID;
  row_type_id UUID;
  row_partner_id UUID;
  related_school_id UUID;
  related_category public.waste_category;
BEGIN
  row_school_id := NULLIF(row_data->>'school_id', '')::UUID;
  row_batch_id := NULLIF(row_data->>'batch_id', '')::UUID;
  row_audit_id := NULLIF(row_data->>'audit_id', '')::UUID;
  row_finding_id := NULLIF(row_data->>'finding_id', '')::UUID;
  row_activity_id := NULLIF(row_data->>'activity_id', '')::UUID;
  row_location_id := NULLIF(row_data->>'location_id', '')::UUID;
  row_source_id := NULLIF(row_data->>'source_id', '')::UUID;
  row_type_id := NULLIF(row_data->>'waste_type_id', '')::UUID;
  row_partner_id := NULLIF(row_data->>'partner_id', '')::UUID;

  IF row_school_id IS NULL AND row_batch_id IS NOT NULL THEN
    SELECT school_id INTO row_school_id FROM public.waste_batches WHERE id = row_batch_id;
  END IF;
  IF row_school_id IS NULL AND row_audit_id IS NOT NULL THEN
    SELECT school_id INTO row_school_id FROM public.audits WHERE id = row_audit_id;
  END IF;
  IF row_school_id IS NULL AND row_finding_id IS NOT NULL THEN
    SELECT audit.school_id INTO row_school_id
    FROM public.audit_findings finding
    LEFT JOIN public.audits audit ON audit.id = finding.audit_id
    WHERE finding.id = row_finding_id;
  END IF;
  IF row_school_id IS NULL AND row_activity_id IS NOT NULL THEN
    SELECT school_id INTO row_school_id FROM public.activities WHERE id = row_activity_id;
  END IF;

  IF row_location_id IS NOT NULL AND row_school_id IS NOT NULL THEN
    SELECT school_id INTO related_school_id FROM public.locations
    WHERE id = row_location_id AND deleted_at IS NULL;
    IF related_school_id IS DISTINCT FROM row_school_id THEN
      RAISE EXCEPTION 'Lokasi harus berasal dari sekolah yang sama dengan transaksi.';
    END IF;
  END IF;

  IF row_source_id IS NOT NULL AND row_school_id IS NOT NULL THEN
    SELECT school_id INTO related_school_id FROM public.waste_sources
    WHERE id = row_source_id AND deleted_at IS NULL;
    IF NOT FOUND OR (related_school_id IS NOT NULL AND related_school_id IS DISTINCT FROM row_school_id) THEN
      RAISE EXCEPTION 'Sumber sampah tidak tersedia untuk sekolah ini.';
    END IF;
  END IF;

  IF row_type_id IS NOT NULL AND row_school_id IS NOT NULL THEN
    SELECT school_id, category INTO related_school_id, related_category FROM public.waste_types
    WHERE id = row_type_id AND deleted_at IS NULL;
    IF NOT FOUND OR (related_school_id IS NOT NULL AND related_school_id IS DISTINCT FROM row_school_id) THEN
      RAISE EXCEPTION 'Jenis sampah tidak tersedia untuk sekolah ini.';
    END IF;
    IF row_data ? 'category' AND related_category IS DISTINCT FROM (row_data->>'category')::public.waste_category THEN
      RAISE EXCEPTION 'Jenis sampah tidak sesuai dengan kategori transaksi.';
    END IF;
  END IF;

  IF row_partner_id IS NOT NULL AND row_school_id IS NOT NULL THEN
    SELECT school_id INTO related_school_id FROM public.partners
    WHERE id = row_partner_id AND deleted_at IS NULL;
    IF NOT FOUND OR (related_school_id IS NOT NULL AND related_school_id IS DISTINCT FROM row_school_id) THEN
      RAISE EXCEPTION 'Mitra tidak tersedia untuk sekolah ini.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'waste_batches','waste_records','waste_collections','waste_sorting','waste_processing',
    'waste_utilization','waste_sales','residual_disposals','audits','audit_findings','activities'
  ] LOOP
    EXECUTE format('CREATE TRIGGER validate_school_relationships BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.validate_school_relationships()', table_name);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.validate_school_relationships() FROM PUBLIC;
ALTER TABLE public.locations
  ALTER COLUMN qr_token SET DEFAULT encode(gen_random_bytes(32), 'hex');

UPDATE public.locations
SET qr_token = encode(gen_random_bytes(32), 'hex');
ALTER TABLE public.locations
  ALTER COLUMN qr_token SET NOT NULL;

ALTER TABLE public.waste_batches
  ADD CONSTRAINT waste_batches_initial_weight_max CHECK (initial_weight_kg <= 9999.999) NOT VALID;
ALTER TABLE public.waste_records
  ADD CONSTRAINT waste_records_weight_max CHECK (weight_kg <= 9999.999) NOT VALID;
ALTER TABLE public.waste_collections
  ADD CONSTRAINT waste_collections_estimated_weight_max CHECK (estimated_weight_kg IS NULL OR estimated_weight_kg <= 9999.999) NOT VALID,
  ADD CONSTRAINT waste_collections_actual_weight_max CHECK (actual_weight_kg IS NULL OR actual_weight_kg <= 9999.999) NOT VALID;
ALTER TABLE public.waste_sorting
  ADD CONSTRAINT waste_sorting_weight_max CHECK (weight_kg <= 9999.999) NOT VALID;
ALTER TABLE public.waste_movements
  ADD CONSTRAINT waste_movements_weight_max CHECK (weight_kg IS NULL OR weight_kg <= 9999.999) NOT VALID;
ALTER TABLE public.waste_processing
  ADD CONSTRAINT waste_processing_input_weight_max CHECK (input_weight_kg <= 9999.999) NOT VALID,
  ADD CONSTRAINT waste_processing_output_weight_max CHECK (output_weight_kg <= 9999.999) NOT VALID;
ALTER TABLE public.waste_utilization
  ADD CONSTRAINT waste_utilization_weight_max CHECK (weight_kg <= 9999.999) NOT VALID;
ALTER TABLE public.waste_sales
  ADD CONSTRAINT waste_sales_weight_max CHECK (weight_kg <= 9999.999) NOT VALID;
ALTER TABLE public.residual_disposals
  ADD CONSTRAINT residual_disposals_weight_max CHECK (weight_kg <= 9999.999) NOT VALID;
ALTER TABLE public.activities
  ADD CONSTRAINT activities_waste_collected_max CHECK (waste_collected_kg <= 9999.999) NOT VALID,
  ADD CONSTRAINT activities_waste_utilized_max CHECK (waste_utilized_kg <= 9999.999) NOT VALID;

REVOKE SELECT ON public.locations FROM authenticated;
GRANT SELECT (id, school_id, name, code, type, description, is_demo, deleted_at, created_at, updated_at)
  ON public.locations TO authenticated;

CREATE FUNCTION public.get_location_qr_tokens()
RETURNS TABLE(location_id UUID, qr_token TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Hanya pengelola sekolah yang dapat melihat token QR.';
  END IF;

  RETURN QUERY
  SELECT location.id, location.qr_token
  FROM public.locations location
  WHERE public.can_access_school(location.school_id) AND location.deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_location_qr_tokens() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_location_qr_tokens() TO authenticated;

DROP POLICY IF EXISTS "recorders update findings" ON public.audit_findings;
CREATE POLICY "school managers update findings" ON public.audit_findings
  FOR UPDATE TO authenticated
  USING (
    public.is_manager(auth.uid())
    AND (public.can_access_audit(audit_id) OR public.can_access_location(location_id))
  )
  WITH CHECK (
    public.is_manager(auth.uid())
    AND (public.can_access_audit(audit_id) OR public.can_access_location(location_id))
  );

DROP FUNCTION public.record_waste_generation_v2(
  UUID, UUID, UUID, UUID, public.waste_category, NUMERIC, TIMESTAMPTZ, UUID, TEXT, TEXT
);

CREATE FUNCTION public.record_waste_generation_v2(
  p_request_id UUID,
  p_school_id UUID,
  p_location_id UUID,
  p_source_id UUID,
  p_category public.waste_category,
  p_weight_kg NUMERIC,
  p_recorded_at TIMESTAMPTZ,
  p_waste_type_id UUID DEFAULT NULL,
  p_photo_url TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_qr_token TEXT DEFAULT NULL
)
RETURNS TABLE(batch_id UUID, batch_code TEXT, record_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_school_id UUID;
  v_batch_id UUID;
  v_batch_code TEXT;
  v_record_id UUID;
BEGIN
  IF v_user_id IS NULL OR NOT public.can_record(v_user_id) THEN
    RAISE EXCEPTION 'Akun tidak memiliki izin untuk mencatat sampah.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Kunci permintaan wajib diisi.';
  END IF;

  SELECT batch.id, batch.batch_code INTO v_batch_id, v_batch_code
  FROM public.waste_batches batch
  WHERE batch.request_id = p_request_id AND batch.created_by = v_user_id;
  IF FOUND THEN
    SELECT record.id INTO v_record_id
    FROM public.waste_records record
    WHERE record.batch_id = v_batch_id AND record.deleted_at IS NULL
    ORDER BY record.created_at LIMIT 1;
    RETURN QUERY SELECT v_batch_id, v_batch_code, v_record_id;
    RETURN;
  END IF;

  IF p_weight_kg IS NULL OR p_weight_kg <= 0 OR p_weight_kg > 9999.999
    OR p_weight_kg::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Berat sampah harus lebih besar dari nol dan tidak boleh melebihi 9.999,999 kg.';
  END IF;
  IF NULLIF(p_qr_token, '') IS NULL THEN
    RAISE EXCEPTION 'Token QR lokasi wajib diisi.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Sekolah tidak ditemukan atau sudah dinonaktifkan.';
  END IF;

  IF NOT public.has_role(v_user_id, 'super_admin') THEN
    SELECT school_id INTO v_school_id FROM public.profiles WHERE id = v_user_id;
    IF v_school_id IS DISTINCT FROM p_school_id THEN
      RAISE EXCEPTION 'Akun tidak dapat mencatat data untuk sekolah ini.';
    END IF;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.locations
    WHERE id = p_location_id AND school_id = p_school_id
      AND qr_token = p_qr_token AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Token QR tidak valid untuk lokasi yang dipilih.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.waste_sources WHERE id = p_source_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Sumber sampah tidak ditemukan atau sudah dinonaktifkan.';
  END IF;
  IF p_waste_type_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.waste_types
    WHERE id = p_waste_type_id AND category = p_category AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Jenis sampah tidak sesuai dengan kategori yang dipilih.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('waste-batch:' || to_char(now(), 'YYYYMMDD')));
  v_batch_code := public.next_batch_code();
  INSERT INTO public.waste_batches (
    batch_code, request_id, school_id, location_id, source_id, initial_weight_kg,
    generated_at, created_by
  ) VALUES (
    v_batch_code, p_request_id, p_school_id, p_location_id, p_source_id, p_weight_kg,
    COALESCE(p_recorded_at, now()), v_user_id
  ) RETURNING id INTO v_batch_id;
  INSERT INTO public.waste_records (
    batch_id, school_id, location_id, source_id, waste_type_id, category,
    weight_kg, recorded_at, reporter_id, photo_url, notes
  ) VALUES (
    v_batch_id, p_school_id, p_location_id, p_source_id, p_waste_type_id, p_category,
    p_weight_kg, COALESCE(p_recorded_at, now()), v_user_id, p_photo_url, p_notes
  ) RETURNING id INTO v_record_id;
  RETURN QUERY SELECT v_batch_id, v_batch_code, v_record_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_waste_generation_v2(
  UUID, UUID, UUID, UUID, public.waste_category, NUMERIC, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_waste_generation_v2(
  UUID, UUID, UUID, UUID, public.waste_category, NUMERIC, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT
) TO authenticated;
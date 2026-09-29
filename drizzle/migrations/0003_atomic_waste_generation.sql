CREATE OR REPLACE FUNCTION public.record_waste_generation(
  p_school_id UUID,
  p_location_id UUID,
  p_source_id UUID,
  p_category public.waste_category,
  p_weight_kg NUMERIC,
  p_recorded_at TIMESTAMPTZ,
  p_waste_type_id UUID DEFAULT NULL,
  p_photo_url TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
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

  IF p_weight_kg IS NULL OR p_weight_kg <= 0
    OR p_weight_kg::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Berat sampah harus lebih besar dari nol dan bernilai terbatas.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Sekolah tidak ditemukan atau sudah dinonaktifkan.';
  END IF;

  IF NOT public.has_role(v_user_id, 'super_admin') THEN
    SELECT school_id INTO v_school_id
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_school_id IS DISTINCT FROM p_school_id THEN
      RAISE EXCEPTION 'Akun tidak dapat mencatat data untuk sekolah ini.';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.locations
    WHERE id = p_location_id AND school_id = p_school_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Lokasi tidak ditemukan pada sekolah yang dipilih.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.waste_sources
    WHERE id = p_source_id AND deleted_at IS NULL
  ) THEN
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
    batch_code, school_id, location_id, source_id, initial_weight_kg,
    generated_at, created_by
  ) VALUES (
    v_batch_code, p_school_id, p_location_id, p_source_id, p_weight_kg,
    COALESCE(p_recorded_at, now()), v_user_id
  ) RETURNING id INTO v_batch_id;

  INSERT INTO public.waste_records (
    batch_id, school_id, location_id, source_id, waste_type_id,
    category, weight_kg, recorded_at, reporter_id, photo_url, notes
  ) VALUES (
    v_batch_id, p_school_id, p_location_id, p_source_id, p_waste_type_id,
    p_category, p_weight_kg, COALESCE(p_recorded_at, now()), v_user_id, p_photo_url, p_notes
  ) RETURNING id INTO v_record_id;

  RETURN QUERY SELECT v_batch_id, v_batch_code, v_record_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_waste_generation(
  UUID, UUID, UUID, public.waste_category, NUMERIC, TIMESTAMPTZ, UUID, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_waste_generation(
  UUID, UUID, UUID, public.waste_category, NUMERIC, TIMESTAMPTZ, UUID, TEXT, TEXT
) TO authenticated;
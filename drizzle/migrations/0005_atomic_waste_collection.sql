CREATE OR REPLACE FUNCTION public.record_waste_collection(
  p_batch_id UUID,
  p_collected_at TIMESTAMPTZ,
  p_actual_weight_kg NUMERIC,
  p_estimated_weight_kg NUMERIC DEFAULT NULL,
  p_photo_url TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_school_id UUID;
  v_initial_weight NUMERIC;
  v_stage public.batch_stage;
  v_collected_weight NUMERIC;
  v_collector_name TEXT;
  v_collection_id UUID;
BEGIN
  IF v_user_id IS NULL OR NOT public.can_record(v_user_id) THEN
    RAISE EXCEPTION 'Akun tidak memiliki izin untuk mencatat pengumpulan.';
  END IF;

  IF p_actual_weight_kg IS NULL OR p_actual_weight_kg <= 0
    OR p_actual_weight_kg::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Berat aktual harus lebih besar dari nol dan bernilai terbatas.';
  END IF;

  IF p_estimated_weight_kg IS NOT NULL AND (
    p_estimated_weight_kg < 0 OR p_estimated_weight_kg::TEXT IN ('NaN', 'Infinity', '-Infinity')
  ) THEN
    RAISE EXCEPTION 'Berat perkiraan tidak valid.';
  END IF;

  SELECT school_id, initial_weight_kg, stage
  INTO v_school_id, v_initial_weight, v_stage
  FROM public.waste_batches
  WHERE id = p_batch_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR NOT public.can_access_school(v_school_id) THEN
    RAISE EXCEPTION 'Batch tidak ditemukan atau tidak dapat diakses.';
  END IF;

  IF NOT public.can_record(v_user_id) THEN
    RAISE EXCEPTION 'Akun tidak dapat mencatat pengumpulan untuk sekolah ini.';
  END IF;

  IF v_stage NOT IN ('generated', 'collected') THEN
    RAISE EXCEPTION 'Batch sudah melewati tahap pengumpulan.';
  END IF;

  SELECT COALESCE(SUM(actual_weight_kg), 0)
  INTO v_collected_weight
  FROM public.waste_collections
  WHERE batch_id = p_batch_id AND deleted_at IS NULL;

  IF v_collected_weight + p_actual_weight_kg > v_initial_weight + 0.001 THEN
    RAISE EXCEPTION 'Berat terkumpul melebihi berat awal batch.';
  END IF;

  SELECT full_name INTO v_collector_name FROM public.profiles WHERE id = v_user_id;

  INSERT INTO public.waste_collections (
    batch_id, location_id, source_id, collector_id, collector_name, collected_at,
    estimated_weight_kg, actual_weight_kg, status, photo_url, notes
  )
  SELECT
    batch.id, batch.location_id, batch.source_id, v_user_id, v_collector_name,
    COALESCE(p_collected_at, now()), p_estimated_weight_kg, p_actual_weight_kg,
    'collected', p_photo_url, p_notes
  FROM public.waste_batches batch
  WHERE batch.id = p_batch_id
  RETURNING id INTO v_collection_id;

  UPDATE public.waste_batches
  SET stage = 'collected', collected_at = COALESCE(p_collected_at, now())
  WHERE id = p_batch_id;

  RETURN v_collection_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_waste_collection(UUID, TIMESTAMPTZ, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_waste_collection(UUID, TIMESTAMPTZ, NUMERIC, NUMERIC, TEXT, TEXT) TO authenticated;

DROP POLICY IF EXISTS "recorders create batches" ON public.waste_batches;
DROP POLICY IF EXISTS "recorders create batch activity" ON public.waste_collections;
DROP POLICY IF EXISTS "recorders update batch activity" ON public.waste_collections;
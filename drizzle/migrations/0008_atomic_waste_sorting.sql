CREATE OR REPLACE FUNCTION public.record_waste_sorting(
  p_batch_id UUID,
  p_items JSONB,
  p_sorted_at TIMESTAMPTZ DEFAULT now(),
  p_notes TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_school_id UUID;
  v_initial_weight NUMERIC;
  v_available_weight NUMERIC;
  v_stage public.batch_stage;
  v_total_weight NUMERIC := 0;
  v_item RECORD;
  v_count INTEGER := 0;
BEGIN
  IF v_user_id IS NULL OR NOT public.can_record(v_user_id) THEN
    RAISE EXCEPTION 'Akun tidak memiliki izin untuk memilah sampah.';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Tambahkan setidaknya satu kategori hasil pilahan.';
  END IF;

  SELECT school_id, initial_weight_kg, stage
  INTO v_school_id, v_initial_weight, v_stage
  FROM public.waste_batches
  WHERE id = p_batch_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR NOT public.can_access_school(v_school_id) THEN
    RAISE EXCEPTION 'Batch tidak ditemukan atau tidak dapat diakses.';
  END IF;
  IF v_stage NOT IN ('collected', 'weighed') THEN
    RAISE EXCEPTION 'Batch harus dikumpulkan dan ditimbang sebelum dipilah.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.waste_sorting
    WHERE batch_id = p_batch_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Batch ini sudah memiliki hasil pemilahan.';
  END IF;

  SELECT COALESCE(SUM(actual_weight_kg), 0)
  INTO v_available_weight
  FROM public.waste_collections
  WHERE batch_id = p_batch_id AND deleted_at IS NULL;
  IF v_available_weight <= 0 THEN
    RAISE EXCEPTION 'Batch belum memiliki berat aktual hasil pengumpulan.';
  END IF;

  FOR v_item IN
    SELECT item.category, item.waste_type_id, item.weight_kg
    FROM jsonb_to_recordset(p_items) AS item(
      category public.waste_category,
      waste_type_id UUID,
      weight_kg NUMERIC
    )
  LOOP
    IF v_item.weight_kg IS NULL OR v_item.weight_kg <= 0
      OR v_item.weight_kg::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'Setiap berat hasil pilahan harus lebih besar dari nol.';
    END IF;
    IF v_item.waste_type_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.waste_types
      WHERE id = v_item.waste_type_id AND category = v_item.category AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Jenis sampah tidak cocok dengan kategori hasil pilahan.';
    END IF;
    v_total_weight := v_total_weight + v_item.weight_kg;
  END LOOP;

  IF v_total_weight > v_available_weight + 0.001 THEN
    RAISE EXCEPTION 'Total hasil pilahan (%) melebihi berat terkumpul (%).', v_total_weight, v_available_weight;
  END IF;

  FOR v_item IN
    SELECT item.category, item.waste_type_id, item.weight_kg
    FROM jsonb_to_recordset(p_items) AS item(
      category public.waste_category,
      waste_type_id UUID,
      weight_kg NUMERIC
    )
  LOOP
    INSERT INTO public.waste_sorting (
      batch_id, category, waste_type_id, weight_kg, sorted_at, sorted_by, notes
    ) VALUES (
      p_batch_id, v_item.category, v_item.waste_type_id, v_item.weight_kg,
      COALESCE(p_sorted_at, now()), v_user_id, p_notes
    );
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.waste_batches SET stage = 'sorted' WHERE id = p_batch_id;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.record_waste_sorting(UUID, JSONB, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_waste_sorting(UUID, JSONB, TIMESTAMPTZ, TEXT) TO authenticated;

DROP POLICY IF EXISTS "recorders create batch activity" ON public.waste_sorting;
DROP POLICY IF EXISTS "recorders update batch activity" ON public.waste_sorting;
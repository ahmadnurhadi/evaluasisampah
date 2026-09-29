CREATE OR REPLACE FUNCTION public.record_waste_processing(
  p_batch_id UUID,
  p_method public.processing_method,
  p_input_weight_kg NUMERIC,
  p_output_weight_kg NUMERIC,
  p_processed_at TIMESTAMPTZ DEFAULT now(),
  p_responsible_name TEXT DEFAULT NULL,
  p_result TEXT DEFAULT NULL,
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
  v_stage public.batch_stage;
  v_available NUMERIC;
  v_id UUID;
BEGIN
  IF v_user_id IS NULL OR NOT public.can_record(v_user_id) THEN
    RAISE EXCEPTION 'Akun tidak memiliki izin untuk mencatat pengolahan.';
  END IF;
  IF p_input_weight_kg IS NULL OR p_input_weight_kg <= 0
    OR p_input_weight_kg::TEXT IN ('NaN', 'Infinity', '-Infinity')
    OR p_output_weight_kg IS NULL OR p_output_weight_kg < 0
    OR p_output_weight_kg::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Berat input atau output tidak valid.';
  END IF;
  IF p_output_weight_kg > p_input_weight_kg + 0.001 THEN
    RAISE EXCEPTION 'Berat output tidak boleh melebihi berat input.';
  END IF;

  SELECT school_id, stage INTO v_school_id, v_stage
  FROM public.waste_batches
  WHERE id = p_batch_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND OR NOT public.can_access_school(v_school_id) THEN
    RAISE EXCEPTION 'Batch tidak ditemukan atau tidak dapat diakses.';
  END IF;
  IF v_stage NOT IN ('collected', 'weighed', 'sorted', 'processed') THEN
    RAISE EXCEPTION 'Batch belum berada pada tahap yang dapat diolah.';
  END IF;

  SELECT COALESCE(SUM(actual_weight_kg), 0)
    - COALESCE((SELECT SUM(input_weight_kg) FROM public.waste_processing WHERE batch_id = p_batch_id AND deleted_at IS NULL), 0)
    - COALESCE((SELECT SUM(weight_kg) FROM public.waste_utilization WHERE batch_id = p_batch_id AND deleted_at IS NULL), 0)
    - COALESCE((SELECT SUM(weight_kg) FROM public.waste_sales WHERE batch_id = p_batch_id AND deleted_at IS NULL), 0)
    - COALESCE((SELECT SUM(weight_kg) FROM public.residual_disposals WHERE batch_id = p_batch_id AND deleted_at IS NULL), 0)
  INTO v_available
  FROM public.waste_collections
  WHERE batch_id = p_batch_id AND deleted_at IS NULL;
  IF p_input_weight_kg > GREATEST(v_available, 0) + 0.001 THEN
    RAISE EXCEPTION 'Berat input melampaui massa batch yang masih tersedia (% kg).', GREATEST(v_available, 0);
  END IF;

  INSERT INTO public.waste_processing (
    batch_id, method, input_weight_kg, output_weight_kg, processed_at,
    responsible_id, responsible_name, result, photo_url, notes
  ) VALUES (
    p_batch_id, p_method, p_input_weight_kg, p_output_weight_kg, COALESCE(p_processed_at, now()),
    v_user_id, p_responsible_name, p_result, p_photo_url, p_notes
  ) RETURNING id INTO v_id;
  UPDATE public.waste_batches SET stage = 'processed' WHERE id = p_batch_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_waste_utilization(
  p_batch_id UUID,
  p_utilization_type TEXT,
  p_weight_kg NUMERIC,
  p_destination TEXT DEFAULT NULL,
  p_partner_id UUID DEFAULT NULL,
  p_used_at TIMESTAMPTZ DEFAULT now(),
  p_economic_value NUMERIC DEFAULT 0,
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
  v_stage public.batch_stage;
  v_available NUMERIC;
  v_id UUID;
BEGIN
  IF v_user_id IS NULL OR NOT public.can_record(v_user_id) THEN
    RAISE EXCEPTION 'Akun tidak memiliki izin untuk mencatat pemanfaatan.';
  END IF;
  IF p_weight_kg IS NULL OR p_weight_kg <= 0 OR p_weight_kg::TEXT IN ('NaN', 'Infinity', '-Infinity')
    OR p_economic_value IS NULL OR p_economic_value < 0 THEN
    RAISE EXCEPTION 'Berat atau nilai ekonomi tidak valid.';
  END IF;
  IF NULLIF(trim(p_utilization_type), '') IS NULL THEN
    RAISE EXCEPTION 'Jenis pemanfaatan wajib diisi.';
  END IF;

  SELECT school_id, stage INTO v_school_id, v_stage
  FROM public.waste_batches
  WHERE id = p_batch_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND OR NOT public.can_access_school(v_school_id) THEN
    RAISE EXCEPTION 'Batch tidak ditemukan atau tidak dapat diakses.';
  END IF;
  IF v_stage NOT IN ('processed', 'sorted', 'collected', 'weighed') THEN
    RAISE EXCEPTION 'Batch belum tersedia untuk dimanfaatkan.';
  END IF;

  SELECT COALESCE(SUM(output_weight_kg), 0)
    - COALESCE((SELECT SUM(weight_kg) FROM public.waste_utilization WHERE batch_id = p_batch_id AND deleted_at IS NULL), 0)
    - COALESCE((SELECT SUM(weight_kg) FROM public.waste_sales WHERE batch_id = p_batch_id AND deleted_at IS NULL), 0)
  INTO v_available
  FROM public.waste_processing
  WHERE batch_id = p_batch_id AND deleted_at IS NULL;
  IF p_weight_kg > GREATEST(v_available, 0) + 0.001 THEN
    RAISE EXCEPTION 'Berat pemanfaatan melampaui output olah yang tersedia (% kg).', GREATEST(v_available, 0);
  END IF;

  INSERT INTO public.waste_utilization (
    batch_id, utilization_type, weight_kg, destination, partner_id,
    used_at, economic_value, photo_url, notes
  ) VALUES (
    p_batch_id, p_utilization_type, p_weight_kg, p_destination, p_partner_id,
    COALESCE(p_used_at, now()), p_economic_value, p_photo_url, p_notes
  ) RETURNING id INTO v_id;
  UPDATE public.waste_batches SET stage = 'utilized' WHERE id = p_batch_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_waste_sale(
  p_batch_id UUID,
  p_waste_type_id UUID,
  p_weight_kg NUMERIC,
  p_price_per_kg NUMERIC,
  p_partner_id UUID DEFAULT NULL,
  p_sold_at TIMESTAMPTZ DEFAULT now(),
  p_payment_status public.payment_status DEFAULT 'unpaid',
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE(sale_id UUID, transaction_code TEXT, total_value NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_school_id UUID;
  v_stage public.batch_stage;
  v_category public.waste_category;
  v_recyclable BOOLEAN;
  v_available NUMERIC;
  v_id UUID;
  v_code TEXT;
  v_value NUMERIC;
BEGIN
  IF v_user_id IS NULL OR NOT public.is_manager(v_user_id) THEN
    RAISE EXCEPTION 'Hanya pengelola sekolah yang dapat mencatat transaksi penjualan.';
  END IF;
  IF p_weight_kg IS NULL OR p_weight_kg <= 0 OR p_weight_kg::TEXT IN ('NaN', 'Infinity', '-Infinity')
    OR p_price_per_kg IS NULL OR p_price_per_kg < 0 THEN
    RAISE EXCEPTION 'Berat atau harga jual tidak valid.';
  END IF;

  SELECT school_id, stage INTO v_school_id, v_stage
  FROM public.waste_batches
  WHERE id = p_batch_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND OR NOT public.can_access_school(v_school_id) THEN
    RAISE EXCEPTION 'Batch tidak ditemukan atau tidak dapat diakses.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.partners WHERE id = p_partner_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Mitra penjualan wajib dipilih.';
  END IF;

  SELECT category, recyclable INTO v_category, v_recyclable
  FROM public.waste_types
  WHERE id = p_waste_type_id AND deleted_at IS NULL;
  IF NOT FOUND OR NOT v_recyclable THEN
    RAISE EXCEPTION 'Jenis sampah harus terdaftar sebagai material daur ulang.';
  END IF;

  SELECT COALESCE(SUM(weight_kg), 0)
    - COALESCE((SELECT SUM(weight_kg) FROM public.waste_sales WHERE batch_id = p_batch_id AND waste_type_id = p_waste_type_id AND deleted_at IS NULL), 0)
  INTO v_available
  FROM public.waste_sorting
  WHERE batch_id = p_batch_id AND category = v_category AND waste_type_id = p_waste_type_id AND deleted_at IS NULL;
  IF p_weight_kg > GREATEST(v_available, 0) + 0.001 THEN
    RAISE EXCEPTION 'Berat penjualan melampaui material terpilah yang tersedia (% kg).', GREATEST(v_available, 0);
  END IF;

  INSERT INTO public.waste_sales (
    batch_id, partner_id, waste_type_id, category, weight_kg,
    price_per_kg, sold_at, payment_status, notes
  ) VALUES (
    p_batch_id, p_partner_id, p_waste_type_id, v_category, p_weight_kg,
    p_price_per_kg, COALESCE(p_sold_at, now()), p_payment_status, p_notes
  ) RETURNING id, waste_sales.transaction_code, waste_sales.total_value
    INTO v_id, v_code, v_value;
  UPDATE public.waste_batches SET stage = 'sold' WHERE id = p_batch_id;
  RETURN QUERY SELECT v_id, v_code, v_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_residual_disposal(
  p_batch_id UUID,
  p_weight_kg NUMERIC,
  p_destination TEXT,
  p_disposal_method TEXT,
  p_disposed_at TIMESTAMPTZ DEFAULT now(),
  p_transporter TEXT DEFAULT NULL,
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
  v_category public.waste_category;
  v_available NUMERIC;
  v_id UUID;
BEGIN
  IF v_user_id IS NULL OR NOT public.can_record(v_user_id) THEN
    RAISE EXCEPTION 'Akun tidak memiliki izin untuk mencatat residu.';
  END IF;
  IF p_weight_kg IS NULL OR p_weight_kg <= 0 OR p_weight_kg::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Berat residu harus lebih besar dari nol.';
  END IF;
  IF NULLIF(trim(p_destination), '') IS NULL OR NULLIF(trim(p_disposal_method), '') IS NULL THEN
    RAISE EXCEPTION 'Tujuan dan metode pembuangan wajib diisi.';
  END IF;

  SELECT school_id INTO v_school_id
  FROM public.waste_batches
  WHERE id = p_batch_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND OR NOT public.can_access_school(v_school_id) THEN
    RAISE EXCEPTION 'Batch tidak ditemukan atau tidak dapat diakses.';
  END IF;

  SELECT COALESCE(SUM(weight_kg), 0)
    - COALESCE((SELECT SUM(weight_kg) FROM public.residual_disposals WHERE batch_id = p_batch_id AND deleted_at IS NULL), 0)
  INTO v_available
  FROM public.waste_sorting
  WHERE batch_id = p_batch_id AND category = 'residual' AND deleted_at IS NULL;
  IF p_weight_kg > GREATEST(v_available, 0) + 0.001 THEN
    RAISE EXCEPTION 'Berat pembuangan melampaui residu terpilah yang tersedia (% kg).', GREATEST(v_available, 0);
  END IF;

  INSERT INTO public.residual_disposals (
    batch_id, weight_kg, destination, disposal_method, disposed_at,
    transporter, photo_url, notes
  ) VALUES (
    p_batch_id, p_weight_kg, p_destination, p_disposal_method, COALESCE(p_disposed_at, now()),
    p_transporter, p_photo_url, p_notes
  ) RETURNING id INTO v_id;
  UPDATE public.waste_batches SET stage = 'disposed' WHERE id = p_batch_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_waste_processing(UUID, public.processing_method, NUMERIC, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_waste_processing(UUID, public.processing_method, NUMERIC, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.record_waste_utilization(UUID, TEXT, NUMERIC, TEXT, UUID, TIMESTAMPTZ, NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_waste_utilization(UUID, TEXT, NUMERIC, TEXT, UUID, TIMESTAMPTZ, NUMERIC, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.record_waste_sale(UUID, UUID, NUMERIC, NUMERIC, UUID, TIMESTAMPTZ, public.payment_status, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_waste_sale(UUID, UUID, NUMERIC, NUMERIC, UUID, TIMESTAMPTZ, public.payment_status, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.record_residual_disposal(UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_residual_disposal(UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO authenticated;

DROP POLICY IF EXISTS "recorders create batch activity" ON public.waste_processing;
DROP POLICY IF EXISTS "recorders update batch activity" ON public.waste_processing;
DROP POLICY IF EXISTS "recorders create batch activity" ON public.waste_utilization;
DROP POLICY IF EXISTS "recorders update batch activity" ON public.waste_utilization;
DROP POLICY IF EXISTS "recorders create batch activity" ON public.waste_sales;
DROP POLICY IF EXISTS "recorders update batch activity" ON public.waste_sales;
DROP POLICY IF EXISTS "recorders create batch activity" ON public.residual_disposals;
DROP POLICY IF EXISTS "recorders update batch activity" ON public.residual_disposals;
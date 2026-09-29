CREATE OR REPLACE FUNCTION public.record_environmental_audit(
  p_school_id UUID,
  p_location_id UUID,
  p_audited_at DATE,
  p_auditor_name TEXT,
  p_scores JSONB,
  p_photo_url TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE(audit_id UUID, total_score NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_audit_id UUID;
  v_total_weight NUMERIC := 0;
  v_weighted_score NUMERIC := 0;
  v_item RECORD;
BEGIN
  IF v_user_id IS NULL OR NOT public.can_manage_school(p_school_id) THEN
    RAISE EXCEPTION 'Akun tidak memiliki izin untuk membuat audit di sekolah ini.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.locations
    WHERE id = p_location_id AND school_id = p_school_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Lokasi tidak ditemukan pada sekolah ini.';
  END IF;
  IF NULLIF(trim(p_auditor_name), '') IS NULL THEN
    RAISE EXCEPTION 'Nama auditor wajib diisi.';
  END IF;
  IF jsonb_typeof(p_scores) <> 'array' OR jsonb_array_length(p_scores) = 0 THEN
    RAISE EXCEPTION 'Audit harus memiliki nilai indikator.';
  END IF;

  FOR v_item IN
    SELECT item.indicator_id, item.score, item.note
    FROM jsonb_to_recordset(p_scores) AS item(indicator_id UUID, score NUMERIC, note TEXT)
  LOOP
    IF v_item.score IS NULL OR v_item.score < 0 OR v_item.score::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'Nilai indikator harus nol atau lebih dan bernilai terbatas.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.audit_indicators indicator
      WHERE indicator.id = v_item.indicator_id AND indicator.active
        AND (indicator.school_id IS NULL OR indicator.school_id = p_school_id)
        AND v_item.score <= indicator.max_score
    ) THEN
      RAISE EXCEPTION 'Indikator tidak aktif, bukan milik sekolah, atau nilainya melebihi batas.';
    END IF;
    SELECT v_total_weight + indicator.weight,
      v_weighted_score + (v_item.score / indicator.max_score) * 100 * indicator.weight
    INTO v_total_weight, v_weighted_score
    FROM public.audit_indicators indicator WHERE indicator.id = v_item.indicator_id;
  END LOOP;

  IF EXISTS (
    SELECT item.indicator_id
    FROM jsonb_to_recordset(p_scores) AS item(indicator_id UUID, score NUMERIC, note TEXT)
    GROUP BY item.indicator_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Indikator duplikat.';
  END IF;

  IF v_total_weight <= 0 THEN
    RAISE EXCEPTION 'Bobot indikator audit harus lebih besar dari nol.';
  END IF;

  INSERT INTO public.audits (
    school_id, location_id, auditor_id, auditor_name, audited_at, total_score, photo_url, notes
  ) VALUES (
    p_school_id, p_location_id, v_user_id, p_auditor_name, COALESCE(p_audited_at, CURRENT_DATE),
    ROUND(v_weighted_score / v_total_weight, 2), p_photo_url, p_notes
  ) RETURNING id INTO v_audit_id;

  INSERT INTO public.audit_scores (audit_id, indicator_id, score, note)
  SELECT v_audit_id, item.indicator_id, item.score, item.note
  FROM jsonb_to_recordset(p_scores) AS item(indicator_id UUID, score NUMERIC, note TEXT);

  RETURN QUERY SELECT v_audit_id, ROUND(v_weighted_score / v_total_weight, 2);
END;
$$;

REVOKE ALL ON FUNCTION public.record_environmental_audit(UUID, UUID, DATE, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_environmental_audit(UUID, UUID, DATE, TEXT, JSONB, TEXT, TEXT) TO authenticated;
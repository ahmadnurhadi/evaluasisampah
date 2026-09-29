CREATE OR REPLACE FUNCTION public.record_environmental_activity(
  p_school_id UUID,
  p_name TEXT,
  p_activity_date DATE,
  p_location_id UUID DEFAULT NULL,
  p_organizer TEXT DEFAULT NULL,
  p_participants TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_waste_collected_kg NUMERIC DEFAULT 0,
  p_waste_utilized_kg NUMERIC DEFAULT 0,
  p_photo_url TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_result TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_activity_id UUID;
  v_participants TEXT[];
BEGIN
  IF v_user_id IS NULL OR NOT public.can_record(v_user_id) OR NOT public.can_access_school(p_school_id) THEN
    RAISE EXCEPTION 'Akun tidak memiliki izin mencatat kegiatan di sekolah ini.';
  END IF;
  IF NULLIF(trim(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'Nama kegiatan wajib diisi.';
  END IF;
  IF p_waste_collected_kg IS NULL OR p_waste_collected_kg < 0
    OR p_waste_utilized_kg IS NULL OR p_waste_utilized_kg < 0
    OR p_waste_collected_kg::TEXT IN ('NaN', 'Infinity', '-Infinity')
    OR p_waste_utilized_kg::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Berat kegiatan tidak valid.';
  END IF;
  IF p_waste_utilized_kg > p_waste_collected_kg + 0.001 THEN
    RAISE EXCEPTION 'Berat sampah yang dimanfaatkan tidak boleh melebihi berat terkumpul.';
  END IF;
  IF p_location_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.locations
    WHERE id = p_location_id AND school_id = p_school_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Lokasi kegiatan bukan bagian dari sekolah ini.';
  END IF;

  SELECT COALESCE(array_agg(clean_name), ARRAY[]::TEXT[])
  INTO v_participants
  FROM (
    SELECT DISTINCT trim(input.name) AS clean_name
    FROM unnest(COALESCE(p_participants, ARRAY[]::TEXT[])) AS input(name)
    WHERE NULLIF(trim(input.name), '') IS NOT NULL
  ) AS cleaned;

  INSERT INTO public.activities (
    school_id, name, activity_date, location_id, organizer, participant_count,
    waste_collected_kg, waste_utilized_kg, photo_url, description, result
  ) VALUES (
    p_school_id, trim(p_name), COALESCE(p_activity_date, CURRENT_DATE), p_location_id,
    NULLIF(trim(p_organizer), ''), cardinality(v_participants),
    p_waste_collected_kg, p_waste_utilized_kg, p_photo_url, p_description, p_result
  ) RETURNING id INTO v_activity_id;

  INSERT INTO public.activity_participants (activity_id, name)
  SELECT v_activity_id, participant.name FROM unnest(v_participants) AS participant(name);

  RETURN v_activity_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_environmental_activity(UUID, TEXT, DATE, UUID, TEXT, TEXT[], NUMERIC, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_environmental_activity(UUID, TEXT, DATE, UUID, TEXT, TEXT[], NUMERIC, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
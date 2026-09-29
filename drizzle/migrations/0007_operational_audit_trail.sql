CREATE TABLE public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  actor_id UUID,
  entity_table TEXT NOT NULL,
  entity_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_events_school_created
  ON public.audit_events(school_id, created_at DESC);
CREATE INDEX idx_audit_events_entity
  ON public.audit_events(entity_table, entity_id, created_at DESC);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
CREATE POLICY "school managers read audit events" ON public.audit_events
  FOR SELECT TO authenticated
  USING (public.is_manager(auth.uid()) AND public.can_access_school(school_id));

CREATE OR REPLACE FUNCTION public.capture_operational_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_data JSONB;
  old_snapshot JSONB;
  new_snapshot JSONB;
  row_batch_id UUID;
  row_audit_id UUID;
  row_finding_id UUID;
  row_activity_id UUID;
  row_location_id UUID;
  row_school_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_data := to_jsonb(OLD);
    old_snapshot := row_data;
  ELSE
    row_data := to_jsonb(NEW);
    new_snapshot := row_data;
    IF TG_OP = 'UPDATE' THEN
      old_snapshot := to_jsonb(OLD);
    END IF;
  END IF;

  row_school_id := NULLIF(row_data->>'school_id', '')::UUID;
  row_batch_id := NULLIF(row_data->>'batch_id', '')::UUID;
  row_audit_id := NULLIF(row_data->>'audit_id', '')::UUID;
  row_finding_id := NULLIF(row_data->>'finding_id', '')::UUID;
  row_activity_id := NULLIF(row_data->>'activity_id', '')::UUID;
  row_location_id := NULLIF(row_data->>'location_id', '')::UUID;

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
  IF row_school_id IS NULL AND row_location_id IS NOT NULL THEN
    SELECT school_id INTO row_school_id FROM public.locations WHERE id = row_location_id;
  END IF;

  INSERT INTO public.audit_events (
    school_id, actor_id, entity_table, entity_id, operation, old_data, new_data
  ) VALUES (
    row_school_id,
    auth.uid(),
    TG_TABLE_NAME,
    (row_data->>'id')::UUID,
    TG_OP,
    old_snapshot,
    new_snapshot
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'waste_batches','waste_records','waste_collections','waste_sorting','waste_processing',
    'waste_utilization','waste_sales','residual_disposals','audits','audit_scores',
    'audit_findings','action_plans','activities','activity_participants'
  ] LOOP
    EXECUTE format('CREATE TRIGGER audit_operational_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.capture_operational_audit_event()', table_name);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.capture_operational_audit_event() FROM PUBLIC;
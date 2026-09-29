ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL;
ALTER TABLE public.audit_indicators
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.waste_sources
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.waste_types
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

UPDATE public.activities AS activity
SET school_id = location.school_id
FROM public.locations AS location
WHERE activity.location_id = location.id AND activity.school_id IS NULL;

CREATE OR REPLACE FUNCTION public.current_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.can_access_school(_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin')
    OR (_school_id IS NOT NULL AND _school_id = public.current_school_id());
$$;

CREATE OR REPLACE FUNCTION public.can_manage_school(_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin')
    OR (public.is_manager(auth.uid()) AND _school_id = public.current_school_id());
$$;

CREATE OR REPLACE FUNCTION public.can_manage_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin')
    OR (public.is_manager(auth.uid()) AND EXISTS (
      SELECT 1 FROM public.profiles target
      WHERE target.id = _user_id AND target.school_id = public.current_school_id()
    ));
$$;

CREATE OR REPLACE FUNCTION public.can_access_user_school(_owner_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _owner_id = auth.uid()::TEXT
    OR EXISTS (
      SELECT 1 FROM public.profiles target
      WHERE target.id::TEXT = _owner_id AND public.can_access_school(target.school_id)
    )
    OR public.has_role(auth.uid(), 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.can_access_batch(_batch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.waste_batches batch
    WHERE batch.id = _batch_id AND public.can_access_school(batch.school_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_location(_location_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.locations location
    WHERE location.id = _location_id AND public.can_access_school(location.school_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_audit(_audit_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.audits audit
    WHERE audit.id = _audit_id AND public.can_access_school(audit.school_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_finding(_finding_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.audit_findings finding
    WHERE finding.id = _finding_id
      AND (public.can_access_audit(finding.audit_id) OR public.can_access_location(finding.location_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_activity(_activity_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.activities activity
    WHERE activity.id = _activity_id AND public.can_access_school(activity.school_id)
  );
$$;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'schools','locations','waste_sources','waste_types','partners','waste_batches','waste_records',
    'waste_collections','waste_sorting','waste_movements','waste_processing','waste_utilization',
    'waste_sales','residual_disposals','audit_indicators','audits','audit_scores','audit_findings',
    'action_plans','activities','activity_participants','evidence_photos'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "read all authenticated" ON public.%I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "insert by recorder" ON public.%I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "update by recorder" ON public.%I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "delete by manager" ON public.%I', table_name);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "own profile insert" ON public.profiles;
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
DROP POLICY IF EXISTS "manager deletes profile" ON public.profiles;
CREATE POLICY "profile owner or school manager reads" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR (public.is_manager(auth.uid()) AND public.can_access_school(school_id)));
CREATE POLICY "school managers update profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.can_manage_user(id))
  WITH CHECK (public.can_manage_user(id));

DROP POLICY IF EXISTS "roles readable" ON public.user_roles;
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
CREATE POLICY "own or school-managed roles are readable" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_user(user_id));
CREATE POLICY "school admins assign nonprivileged roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_user(user_id)
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR (
        public.has_role(auth.uid(), 'school_admin')
        AND role IN ('coordinator', 'teacher', 'cleaning_staff', 'student', 'principal')
      )
    )
  );
CREATE POLICY "school admins update nonprivileged roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (
    public.can_manage_user(user_id)
    AND (public.has_role(auth.uid(), 'super_admin') OR role <> 'super_admin')
  )
  WITH CHECK (
    public.can_manage_user(user_id)
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR (
        public.has_role(auth.uid(), 'school_admin')
        AND role IN ('coordinator', 'teacher', 'cleaning_staff', 'student', 'principal')
      )
    )
  );
CREATE POLICY "school admins remove nonprivileged roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    public.can_manage_user(user_id)
    AND (public.has_role(auth.uid(), 'super_admin') OR (role <> 'super_admin' AND role <> 'school_admin'))
  );

CREATE POLICY "school members read school" ON public.schools
  FOR SELECT TO authenticated USING (public.can_access_school(id));
CREATE POLICY "super admins create schools" ON public.schools
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "school managers update school" ON public.schools
  FOR UPDATE TO authenticated
  USING (public.can_manage_school(id)) WITH CHECK (public.can_manage_school(id));

CREATE POLICY "school members read locations" ON public.locations
  FOR SELECT TO authenticated USING (public.can_access_school(school_id));
CREATE POLICY "school managers create locations" ON public.locations
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_school(school_id));
CREATE POLICY "school managers update locations" ON public.locations
  FOR UPDATE TO authenticated
  USING (public.can_manage_school(school_id)) WITH CHECK (public.can_manage_school(school_id));

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['waste_sources','waste_types','partners','audit_indicators'] LOOP
    EXECUTE format('CREATE POLICY "read global and school master" ON public.%I FOR SELECT TO authenticated USING (school_id IS NULL OR public.can_access_school(school_id))', table_name);
    EXECUTE format('CREATE POLICY "manage scoped master" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''super_admin'') OR (school_id IS NOT NULL AND public.can_manage_school(school_id))) WITH CHECK (public.has_role(auth.uid(), ''super_admin'') OR (school_id IS NOT NULL AND public.can_manage_school(school_id)))', table_name);
  END LOOP;
END $$;

CREATE POLICY "school members read batches" ON public.waste_batches
  FOR SELECT TO authenticated USING (public.can_access_school(school_id));
CREATE POLICY "recorders create batches" ON public.waste_batches
  FOR INSERT TO authenticated WITH CHECK (public.can_record(auth.uid()) AND public.can_access_school(school_id));
CREATE POLICY "recorders update batches" ON public.waste_batches
  FOR UPDATE TO authenticated USING (public.can_access_school(school_id) AND public.can_record(auth.uid()))
  WITH CHECK (public.can_access_school(school_id) AND public.can_record(auth.uid()));

CREATE POLICY "school members read waste records" ON public.waste_records
  FOR SELECT TO authenticated USING (public.can_access_school(school_id));
CREATE POLICY "recorders create waste records" ON public.waste_records
  FOR INSERT TO authenticated WITH CHECK (public.can_access_school(school_id) AND public.can_record(auth.uid()));
CREATE POLICY "recorders update waste records" ON public.waste_records
  FOR UPDATE TO authenticated USING (public.can_access_school(school_id) AND public.can_record(auth.uid()))
  WITH CHECK (public.can_access_school(school_id) AND public.can_record(auth.uid()));

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'waste_collections','waste_sorting','waste_processing','waste_utilization','waste_sales','residual_disposals'
  ] LOOP
    EXECUTE format('CREATE POLICY "school members read batch activity" ON public.%I FOR SELECT TO authenticated USING (public.can_access_batch(batch_id))', table_name);
    IF table_name = 'waste_sales' THEN
      EXECUTE format('CREATE POLICY "school managers create batch activity" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_access_batch(batch_id) AND public.is_manager(auth.uid()))', table_name);
      EXECUTE format('CREATE POLICY "school managers update batch activity" ON public.%I FOR UPDATE TO authenticated USING (public.can_access_batch(batch_id) AND public.is_manager(auth.uid())) WITH CHECK (public.can_access_batch(batch_id) AND public.is_manager(auth.uid()))', table_name);
    ELSE
      EXECUTE format('CREATE POLICY "recorders create batch activity" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_access_batch(batch_id) AND public.can_record(auth.uid()))', table_name);
      EXECUTE format('CREATE POLICY "recorders update batch activity" ON public.%I FOR UPDATE TO authenticated USING (public.can_access_batch(batch_id) AND public.can_record(auth.uid())) WITH CHECK (public.can_access_batch(batch_id) AND public.can_record(auth.uid()))', table_name);
    END IF;
  END LOOP;
END $$;

CREATE POLICY "school members read batch movements" ON public.waste_movements
  FOR SELECT TO authenticated USING (public.can_access_batch(batch_id));

CREATE POLICY "school members read audits" ON public.audits
  FOR SELECT TO authenticated USING (public.can_access_school(school_id));
CREATE POLICY "auditors create audits" ON public.audits
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_school(school_id));
CREATE POLICY "auditors update audits" ON public.audits
  FOR UPDATE TO authenticated USING (public.can_manage_school(school_id))
  WITH CHECK (public.can_manage_school(school_id));

CREATE POLICY "school members read audit scores" ON public.audit_scores
  FOR SELECT TO authenticated USING (public.can_access_audit(audit_id));
CREATE POLICY "school managers write audit scores" ON public.audit_scores
  FOR ALL TO authenticated USING (public.can_access_audit(audit_id) AND public.is_manager(auth.uid()))
  WITH CHECK (public.can_access_audit(audit_id) AND public.is_manager(auth.uid()));

CREATE POLICY "school members read findings" ON public.audit_findings
  FOR SELECT TO authenticated
  USING (public.can_access_audit(audit_id) OR public.can_access_location(location_id));
CREATE POLICY "recorders create findings" ON public.audit_findings
  FOR INSERT TO authenticated
  WITH CHECK (public.can_record(auth.uid()) AND (public.can_access_audit(audit_id) OR public.can_access_location(location_id)));
CREATE POLICY "recorders update findings" ON public.audit_findings
  FOR UPDATE TO authenticated
  USING (public.can_record(auth.uid()) AND (public.can_access_audit(audit_id) OR public.can_access_location(location_id)))
  WITH CHECK (public.can_record(auth.uid()) AND (public.can_access_audit(audit_id) OR public.can_access_location(location_id)));

CREATE POLICY "school members read action plans" ON public.action_plans
  FOR SELECT TO authenticated USING (public.can_access_finding(finding_id));
CREATE POLICY "school managers write action plans" ON public.action_plans
  FOR ALL TO authenticated USING (public.can_access_finding(finding_id) AND public.is_manager(auth.uid()))
  WITH CHECK (public.can_access_finding(finding_id) AND public.is_manager(auth.uid()));

CREATE POLICY "school members read activities" ON public.activities
  FOR SELECT TO authenticated USING (public.can_access_school(school_id));
CREATE POLICY "recorders create activities" ON public.activities
  FOR INSERT TO authenticated WITH CHECK (public.can_access_school(school_id) AND public.can_record(auth.uid()));
CREATE POLICY "recorders update activities" ON public.activities
  FOR UPDATE TO authenticated USING (public.can_access_school(school_id) AND public.can_record(auth.uid()))
  WITH CHECK (public.can_access_school(school_id) AND public.can_record(auth.uid()));

CREATE POLICY "school members read activity participants" ON public.activity_participants
  FOR SELECT TO authenticated USING (public.can_access_activity(activity_id));
CREATE POLICY "recorders manage activity participants" ON public.activity_participants
  FOR ALL TO authenticated USING (public.can_access_activity(activity_id) AND public.can_record(auth.uid()))
  WITH CHECK (public.can_access_activity(activity_id) AND public.can_record(auth.uid()));

DROP POLICY IF EXISTS "evidence read authenticated" ON storage.objects;
DROP POLICY IF EXISTS "evidence insert authenticated" ON storage.objects;
CREATE POLICY "evidence read within school" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'evidence' AND public.can_access_user_school(owner::TEXT));
CREATE POLICY "evidence insert own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'evidence' AND (storage.foldername(name))[1] = auth.uid()::TEXT);
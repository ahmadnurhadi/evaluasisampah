DROP POLICY IF EXISTS "profile owner or school manager reads" ON public.profiles;
CREATE POLICY "profile owner school manager or super admin reads" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR (public.is_manager(auth.uid()) AND public.can_access_school(school_id))
  );
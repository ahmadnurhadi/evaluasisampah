CREATE POLICY "evidence read authenticated" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'evidence');
CREATE POLICY "evidence insert authenticated" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'evidence');
CREATE POLICY "evidence update own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'evidence' AND owner = auth.uid());
CREATE POLICY "evidence delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'evidence' AND owner = auth.uid());

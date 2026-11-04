
-- Fix storage: remove anon DELETE on invoice-attachments, restrict to authenticated
DROP POLICY IF EXISTS "Allow public deletes from invoice-attachments" ON storage.objects;
CREATE POLICY "Authenticated delete invoice-attachments" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'invoice-attachments');

-- Also fix any anon policies on notas-fiscais bucket
DROP POLICY IF EXISTS "Allow public deletes from notas-fiscais" ON storage.objects;
CREATE POLICY "Authenticated delete notas-fiscais" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'notas-fiscais');

-- Restrict app_settings SELECT to authenticated only
DROP POLICY IF EXISTS "Allow anon read app_settings" ON public.app_settings;
CREATE POLICY "Allow authenticated read app_settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

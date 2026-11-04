
-- Create a public storage bucket for invoice attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-attachments', 'invoice-attachments', true);

-- Allow anyone to upload files (since there's no auth yet)
CREATE POLICY "Allow public uploads to invoice-attachments"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'invoice-attachments');

-- Allow anyone to read files
CREATE POLICY "Allow public reads from invoice-attachments"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'invoice-attachments');

-- Allow anyone to delete their uploads
CREATE POLICY "Allow public deletes from invoice-attachments"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'invoice-attachments');

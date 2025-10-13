-- Create storage bucket for distributed file chunks
INSERT INTO storage.buckets (id, name, public) 
VALUES ('file-chunks', 'file-chunks', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own chunks
CREATE POLICY "Users can upload file chunks"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'file-chunks' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to read their own chunks
CREATE POLICY "Users can read own file chunks"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'file-chunks' AND auth.uid()::text = (storage.foldername(name))[1]);
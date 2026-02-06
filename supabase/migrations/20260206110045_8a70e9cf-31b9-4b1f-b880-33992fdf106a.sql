-- Create storage bucket for knowledge files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-files',
  'knowledge-files',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'text/plain', 'text/markdown', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);

-- Policy: Users can upload files to their chatbot's folder
CREATE POLICY "Users can upload knowledge files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'knowledge-files' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.chatbots WHERE user_id = auth.uid()
  )
);

-- Policy: Users can view their chatbot's files
CREATE POLICY "Users can view their knowledge files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'knowledge-files' 
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.chatbots WHERE user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Policy: Users can delete their chatbot's files
CREATE POLICY "Users can delete their knowledge files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'knowledge-files' 
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.chatbots WHERE user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Policy: Users can update their chatbot's files
CREATE POLICY "Users can update their knowledge files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'knowledge-files' 
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.chatbots WHERE user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);
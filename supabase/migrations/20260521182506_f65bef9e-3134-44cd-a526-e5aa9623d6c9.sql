
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-images', 'knowledge-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Knowledge images are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'knowledge-images');

CREATE POLICY "Chatbot owners can upload knowledge images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'knowledge-images'
  AND public.is_chatbot_owner(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Chatbot owners can update their knowledge images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'knowledge-images'
  AND public.is_chatbot_owner(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Chatbot owners can delete their knowledge images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'knowledge-images'
  AND public.is_chatbot_owner(((storage.foldername(name))[1])::uuid)
);

-- Prints/fotos enviados ao assistente. Privado: cada pessoa só lê e grava
-- na própria pasta ({user_id}/arquivo). Limite 5 MB, só imagem.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('assistant-uploads', 'assistant-uploads', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE
  SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS assistant_uploads_insert_own ON storage.objects;
CREATE POLICY assistant_uploads_insert_own ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'assistant-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS assistant_uploads_select_own ON storage.objects;
CREATE POLICY assistant_uploads_select_own ON storage.objects
  FOR SELECT USING (bucket_id = 'assistant-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS assistant_uploads_delete_own ON storage.objects;
CREATE POLICY assistant_uploads_delete_own ON storage.objects
  FOR DELETE USING (bucket_id = 'assistant-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

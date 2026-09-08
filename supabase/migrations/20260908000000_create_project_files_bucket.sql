-- O bucket 'project-files' nunca foi criado neste projeto (a migração
-- 20260813083336 só criou as policies de storage.objects). Sem ele o upload
-- na aba "Arquivos & Notas" falha com "Bucket not found".
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('project-files', 'project-files', false, 26214400)
ON CONFLICT (id) DO NOTHING;

-- Tabela de metadados de arquivos
create table if not exists public.project_files (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    project_id uuid references public.projects(id) on delete cascade,
    module text not null,
    entity_id uuid,
    name text not null,
    mime_type text not null,
    size bigint not null,
    storage_path text not null unique,
    created_at timestamptz default now()
);

-- Grants
grant select, insert, update, delete on public.project_files to authenticated;
grant all on public.project_files to service_role;

-- RLS
alter table public.project_files enable row level security;

create policy "Users can manage their own project files"
on public.project_files
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Storage Policies
create policy "Authenticated users can upload project files"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'project-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view their own project files"
on storage.objects
for select
to authenticated
using (bucket_id = 'project-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own project files"
on storage.objects
for delete
to authenticated
using (bucket_id = 'project-files' and (storage.foldername(name))[1] = auth.uid()::text);

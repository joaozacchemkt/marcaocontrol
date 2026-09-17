-- Troca a RLS de "só o dono vê" (auth.uid() = user_id) pra "qualquer membro
-- da área de trabalho vê" (is_workspace_member), em todas as tabelas de
-- dados. Dropa qualquer policy existente por tabela (nome pode variar) e
-- recria uma única policy padrão.
DO $$
DECLARE
  t text;
  pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'contacts', 'projects', 'tasks', 'events', 'financial_transactions',
    'ideas', 'activity_history', 'academic_assignments', 'academic_subjects',
    'academic_exams', 'project_notes', 'useful_links', 'project_contacts',
    'project_files', 'project_relations', 'task_recurrences', 'reminders',
    'financial_recurrences', 'daily_updates'
  ]
  LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY "workspace_access" ON public.%1$I FOR ALL '
      'USING (public.is_workspace_member(auth.uid())) '
      'WITH CHECK (public.is_workspace_member(auth.uid()))',
      t
    );
  END LOOP;
END $$;

-- profiles: chave é `id` (= auth.users.id), não `user_id`, mas a mesma regra
-- de acesso se aplica — qualquer membro pode ver/editar perfis (pra exibir
-- nome de quem é responsável por uma tarefa).
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "workspace_access" ON public.profiles
  FOR ALL USING (public.is_workspace_member(auth.uid()))
  WITH CHECK (public.is_workspace_member(auth.uid()));

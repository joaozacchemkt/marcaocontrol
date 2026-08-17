-- 1. Novos tipos de projeto
ALTER TYPE public.project_type ADD VALUE IF NOT EXISTS 'perfil_imobiliario';
ALTER TYPE public.project_type ADD VALUE IF NOT EXISTS 'reformas';
ALTER TYPE public.project_type ADD VALUE IF NOT EXISTS 'oab';
ALTER TYPE public.project_type ADD VALUE IF NOT EXISTS 'obra';
ALTER TYPE public.project_type ADD VALUE IF NOT EXISTS 'produto_digital';
ALTER TYPE public.project_type ADD VALUE IF NOT EXISTS 'domestico';
ALTER TYPE public.project_type ADD VALUE IF NOT EXISTS 'financeiro_pessoal';
ALTER TYPE public.project_type ADD VALUE IF NOT EXISTS 'investimento_imovel';

-- 2. Config de abas por projeto
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS tab_config jsonb;

-- 3. Gestão de tempo + subtarefas
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS estimated_minutes integer;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS actual_minutes integer;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON public.tasks(parent_task_id);

-- 4. Relações entre projetos
CREATE TABLE IF NOT EXISTS public.project_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  related_project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  relation_type text NOT NULL DEFAULT 'relacionado'
    CHECK (relation_type IN ('relacionado','subprojeto','estrategico','operacional','origem')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, related_project_id, relation_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_relations TO authenticated;
GRANT ALL ON public.project_relations TO service_role;
ALTER TABLE public.project_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own project_relations" ON public.project_relations
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_project_relations_project ON public.project_relations(project_id);

-- 5. Tarefas recorrentes
CREATE TABLE IF NOT EXISTS public.task_recurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  category text,
  frequency text NOT NULL DEFAULT 'semanal'
    CHECK (frequency IN ('diario','semanal','quinzenal','mensal','anual','personalizado')),
  interval_count integer NOT NULL DEFAULT 1,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  next_run date NOT NULL DEFAULT CURRENT_DATE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_recurrences TO authenticated;
GRANT ALL ON public.task_recurrences TO service_role;
ALTER TABLE public.task_recurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own task_recurrences" ON public.task_recurrences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurrence_id uuid REFERENCES public.task_recurrences(id) ON DELETE SET NULL;

-- 6. Lembretes (somente estrutura)
CREATE TABLE IF NOT EXISTS public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_type text,
  entity_id uuid,
  title text NOT NULL,
  remind_at timestamptz NOT NULL,
  recurrence text,
  channel text NOT NULL DEFAULT 'sistema'
    CHECK (channel IN ('sistema','whatsapp','email','ligacao')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','cancelado')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own reminders" ON public.reminders
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. Triggers de updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_project_relations_updated_at ON public.project_relations;
CREATE TRIGGER update_project_relations_updated_at BEFORE UPDATE ON public.project_relations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_task_recurrences_updated_at ON public.task_recurrences;
CREATE TRIGGER update_task_recurrences_updated_at BEFORE UPDATE ON public.task_recurrences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_reminders_updated_at ON public.reminders;
CREATE TRIGGER update_reminders_updated_at BEFORE UPDATE ON public.reminders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
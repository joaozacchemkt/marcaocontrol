CREATE TABLE public.workspace_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Sem título',
  description TEXT,
  stage TEXT NOT NULL DEFAULT 'novo',
  amount NUMERIC(14,2),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  position INTEGER NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_items_project_module ON public.workspace_items (project_id, module);
CREATE INDEX idx_workspace_items_user ON public.workspace_items (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_items TO authenticated;
GRANT ALL ON public.workspace_items TO service_role;

ALTER TABLE public.workspace_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own workspace items"
ON public.workspace_items FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_workspace_items_updated_at
BEFORE UPDATE ON public.workspace_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
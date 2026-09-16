-- Diário: painel de "o que eu fiz / estou fazendo", atualizado ao longo do
-- dia com anotações curtas — pra alguém de fora (o pai do usuário) acompanhar
-- o progresso sem precisar entender o resto do app.
CREATE TABLE public.daily_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own daily updates" ON public.daily_updates
  FOR ALL USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_updates TO authenticated;
GRANT ALL ON public.daily_updates TO service_role;

CREATE TRIGGER update_daily_updates_updated_at BEFORE UPDATE ON public.daily_updates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

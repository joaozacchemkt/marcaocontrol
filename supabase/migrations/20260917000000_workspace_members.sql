-- Base pra ter mais de uma pessoa usando o mesmo painel (área de trabalho
-- compartilhada). Lista fixa de quem tem acesso — sem auto-cadastro: só
-- service_role (migração/admin) adiciona gente aqui.
CREATE TABLE public.workspace_members (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read members" ON public.workspace_members
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;

-- Usada em toda policy de dados: "essa pessoa faz parte da área de
-- trabalho?" — SECURITY DEFINER pra não virar referência circular com a
-- RLS de workspace_members.
CREATE OR REPLACE FUNCTION public.is_workspace_member(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = uid);
$$;

-- Seed: a conta que já existe hoje.
INSERT INTO public.workspace_members (user_id)
SELECT id FROM auth.users WHERE email = 'joaozacche@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

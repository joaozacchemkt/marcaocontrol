-- Assistente de IA dentro do app.
--
-- Conversas e ações são por pessoa (cada um vê só o próprio chat); os dados
-- que o assistente cria continuam nas tabelas normais, compartilhadas pelo
-- workspace como sempre.

CREATE TABLE IF NOT EXISTS public.assistant_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistant_conversations_user_idx
  ON public.assistant_conversations (user_id, updated_at DESC);

-- Cada linha = uma mensagem no formato da API (content = blocos JSON, do
-- jeito que a API devolveu), pra reenviar o histórico sem perder nada.
-- `hidden` = nota de sistema (ex.: "usuário confirmou a ação X") que vai pro
-- modelo mas não aparece como balão no chat.
CREATE TABLE IF NOT EXISTS public.assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content jsonb NOT NULL,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS assistant_messages_conv_idx
  ON public.assistant_messages (conversation_id, created_at);

-- Rastro de tudo que o assistente fez (ou propôs) no sistema.
--   kind   = 'write' (executado na hora, pode desfazer) | 'confirm' (espera o usuário)
--   status = pending → executing → done | cancelled | failed ; done → undone
CREATE TABLE IF NOT EXISTS public.assistant_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('write', 'confirm')),
  status text NOT NULL CHECK (status IN ('pending', 'executing', 'done', 'cancelled', 'failed', 'undone')),
  summary text NOT NULL,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  undo jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistant_actions_conv_idx
  ON public.assistant_actions (conversation_id, created_at);

-- Bugs/sugestões relatados pelo chat.
CREATE TABLE IF NOT EXISTS public.app_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('bug', 'sugestao', 'elogio', 'outro')),
  description text NOT NULL,
  screen text,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'resolvido')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Fatos que o assistente aprende e usa em toda conversa ("Pedrinho é o
-- filho mais novo do Marcus", "aluguel da Papucaia vence dia 10").
-- Compartilhado pelo workspace: o que um ensina, vale pros dois.
CREATE TABLE IF NOT EXISTS public.assistant_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fact text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own conversations" ON public.assistant_conversations;
CREATE POLICY "own conversations" ON public.assistant_conversations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own messages" ON public.assistant_messages;
CREATE POLICY "own messages" ON public.assistant_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own actions" ON public.assistant_actions;
CREATE POLICY "own actions" ON public.assistant_actions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Feedback: qualquer membro do workspace lê (pra quem cuida do app ver os
-- relatos de todo mundo); cada um só cria em nome próprio.
DROP POLICY IF EXISTS "workspace reads feedback" ON public.app_feedback;
CREATE POLICY "workspace reads feedback" ON public.app_feedback
  FOR SELECT USING (public.is_workspace_member(auth.uid()));
DROP POLICY IF EXISTS "own feedback insert" ON public.app_feedback;
CREATE POLICY "own feedback insert" ON public.app_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "workspace updates feedback" ON public.app_feedback;
CREATE POLICY "workspace updates feedback" ON public.app_feedback
  FOR UPDATE USING (public.is_workspace_member(auth.uid()));

DROP POLICY IF EXISTS "workspace memories" ON public.assistant_memories;
CREATE POLICY "workspace memories" ON public.assistant_memories
  FOR ALL USING (public.is_workspace_member(auth.uid()))
  WITH CHECK (public.is_workspace_member(auth.uid()) AND auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_assistant_conversations_updated_at ON public.assistant_conversations;
CREATE TRIGGER update_assistant_conversations_updated_at
  BEFORE UPDATE ON public.assistant_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_assistant_actions_updated_at ON public.assistant_actions;
CREATE TRIGGER update_assistant_actions_updated_at
  BEFORE UPDATE ON public.assistant_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_app_feedback_updated_at ON public.app_feedback;
CREATE TRIGGER update_app_feedback_updated_at
  BEFORE UPDATE ON public.app_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

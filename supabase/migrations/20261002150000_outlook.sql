-- Integração Outlook (Microsoft Graph, somente leitura de e-mail).
-- Conexão é por pessoa: cada um conecta a própria caixa.
CREATE TABLE IF NOT EXISTS public.outlook_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  -- Tokens OAuth criptografados (AES-256-GCM, chave só no servidor).
  token_enc text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- E-mails já tratados pelo assistente (viraram tarefa ou foram ignorados),
-- pra não serem sugeridos de novo.
CREATE TABLE IF NOT EXISTS public.outlook_seen_messages (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('tarefa', 'ignorado')),
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, message_id)
);

ALTER TABLE public.outlook_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlook_seen_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own outlook connection" ON public.outlook_connections;
CREATE POLICY "own outlook connection" ON public.outlook_connections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own seen messages" ON public.outlook_seen_messages;
CREATE POLICY "own seen messages" ON public.outlook_seen_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_outlook_connections_updated_at ON public.outlook_connections;
CREATE TRIGGER update_outlook_connections_updated_at
  BEFORE UPDATE ON public.outlook_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

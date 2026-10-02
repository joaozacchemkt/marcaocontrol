-- "Limpar conversa" sem perder contexto: a conversa é arquivada com um
-- resumo, e os resumos recentes entram no contexto das próximas.
ALTER TABLE public.assistant_conversations
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

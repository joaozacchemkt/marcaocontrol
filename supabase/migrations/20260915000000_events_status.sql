-- Compromissos (events) não tinham noção de "concluído" — só data/hora.
-- Sem isso não dá pra marcar uma reunião já realizada, diferente das
-- tarefas (que já têm status). Segue o mesmo padrão de reminders.status.
ALTER TABLE public.events
  ADD COLUMN status text NOT NULL DEFAULT 'agendado'
    CHECK (status IN ('agendado', 'concluido'));

-- Lembretes: prioridade, etiqueta e recorrência (mesmo padrão já usado em
-- tasks/task_recurrences). A coluna `recurrence` existia desde a criação da
-- tabela mas nunca foi usada por nenhuma tela — vira `recurrence_frequency`
-- e ganha as colunas que faltavam para funcionar de verdade.

ALTER TABLE public.reminders RENAME COLUMN recurrence TO recurrence_frequency;

ALTER TABLE public.reminders
  ADD CONSTRAINT reminders_recurrence_frequency_check
  CHECK (recurrence_frequency IN ('diario','semanal','quinzenal','mensal','anual') OR recurrence_frequency IS NULL);

ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS recurrence_interval integer NOT NULL DEFAULT 1;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS recurrence_end_date date;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS priority public.task_priority NOT NULL DEFAULT 'media';
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS category text;

-- Acelera a listagem de pendentes por data.
CREATE INDEX IF NOT EXISTS idx_reminders_status_remind_at ON public.reminders (status, remind_at);

-- Delegação: quem criou a tarefa (user_id) pode ser diferente de quem é
-- responsável por fazer (assigned_to). Tarefas existentes ficam sem
-- responsável até alguém assumir/atribuir.
ALTER TABLE public.tasks
  ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;

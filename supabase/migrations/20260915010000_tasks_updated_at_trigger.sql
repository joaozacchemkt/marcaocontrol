-- tasks.updated_at nunca era atualizado sozinho (diferente de reminders,
-- task_recurrences, project_relations e financial_recurrences, que já têm
-- esse gatilho). Resultado: "Concluídos hoje" (que filtra por updated_at de
-- hoje) nunca mostrava nada — a tarefa só sumia da lista de pendências, sem
-- aparecer como concluída em lugar nenhum. Mesma causa também deixava o
-- "há X dias aguardando" (dashboard) contando a partir da criação da tarefa,
-- não de quando ela entrou em "aguardando terceiro".
DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

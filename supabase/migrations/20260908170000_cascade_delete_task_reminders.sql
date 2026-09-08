-- Ao excluir uma tarefa, os lembretes ligados a ela somem na mesma transação.
-- reminders.entity_id é polimórfico (sem FK), então via trigger.
CREATE OR REPLACE FUNCTION public.delete_task_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.reminders
  WHERE entity_type = 'task' AND entity_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_task_reminders ON public.tasks;
CREATE TRIGGER trg_delete_task_reminders
  BEFORE DELETE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_task_reminders();

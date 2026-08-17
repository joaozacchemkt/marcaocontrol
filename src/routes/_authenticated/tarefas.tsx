import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { TaskList } from "@/components/tasks/TaskList";

export const Route = createFileRoute("/_authenticated/tarefas")({
  component: TarefasPage,
});

function TarefasPage() {
  return (
    <AppLayout>
      <TaskList />
    </AppLayout>
  );
}

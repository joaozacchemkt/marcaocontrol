import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";

export const Route = createFileRoute("/tarefas")({
  component: TarefasPage,
});

function TarefasPage() {
  return <AppLayout>Tarefas</AppLayout>;
}

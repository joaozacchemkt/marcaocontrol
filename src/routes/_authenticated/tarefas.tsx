import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { TaskList } from "@/components/tasks/TaskList";
import { RecurringTasks } from "@/components/tasks/RecurringTasks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/tarefas")({
  head: () => ({
    meta: [
      { title: "Pendências — Marcão Control" },
      {
        name: "description",
        content:
          "Gestão de pendências, prazos e tarefas recorrentes do cockpit executivo Marcão Control.",
      },
      { property: "og:title", content: "Pendências — Marcão Control" },
      {
        property: "og:description",
        content: "Gestão de pendências, prazos e tarefas recorrentes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TarefasPage,
});

function TarefasPage() {
  return (
    <AppLayout>
      <Tabs defaultValue="tarefas" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tarefas">Pendências</TabsTrigger>
          <TabsTrigger value="recorrentes">Recorrentes</TabsTrigger>
        </TabsList>

        <TabsContent value="tarefas" className="mt-0 focus-visible:outline-none">
          <TaskList />
        </TabsContent>

        <TabsContent value="recorrentes" className="mt-0 focus-visible:outline-none">
          <RecurringTasks />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

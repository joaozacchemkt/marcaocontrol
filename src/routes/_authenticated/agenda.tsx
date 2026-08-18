import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { CalendarAgenda } from "@/components/calendar/CalendarAgenda";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Marcão Control" },
      { name: "description", content: "Compromissos, prazos e tarefas em um calendário executivo integrado." },
      { property: "og:title", content: "Agenda — Marcão Control" },
      { property: "og:description", content: "Compromissos, prazos e tarefas em um calendário executivo integrado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgendaPage,
});

function AgendaPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Agenda Executiva</h1>
          <p className="text-muted-foreground mt-1">Visualize seus compromissos e prazos de forma centralizada.</p>
        </div>
        
        <CalendarAgenda />
      </div>
    </AppLayout>
  );
}


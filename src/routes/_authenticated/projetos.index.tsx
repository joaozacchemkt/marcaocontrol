import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProjectList } from "@/components/projects/ProjectList";

export const Route = createFileRoute("/_authenticated/projetos/")({
  head: () => ({
    meta: [
      { title: "Projetos — Marcão Control" },
      { name: "description", content: "Workspaces de projetos com metas, prazos, orçamentos e progresso." },
      { property: "og:title", content: "Projetos — Marcão Control" },
      { property: "og:description", content: "Workspaces de projetos com metas, prazos, orçamentos e progresso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjetosPage,
});

function ProjetosPage() {
  return (
    <AppLayout>
      <ProjectList />
    </AppLayout>
  );
}

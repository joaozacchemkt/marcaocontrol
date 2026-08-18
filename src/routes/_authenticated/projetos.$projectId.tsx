import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProjectDetail } from "@/components/projects/ProjectDetail";

export const Route = createFileRoute("/_authenticated/projetos/$projectId")({
  head: () => ({
    meta: [
      { title: "Workspace do Projeto — Marcão Control" },
      { name: "description", content: "Ambiente exclusivo do projeto: quadro, tarefas, financeiro, arquivos e timeline." },
      { property: "og:title", content: "Workspace do Projeto — Marcão Control" },
      { property: "og:description", content: "Ambiente exclusivo do projeto: quadro, tarefas, financeiro, arquivos e timeline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  return (
    <AppLayout>
      <ProjectDetail />
    </AppLayout>
  );
}

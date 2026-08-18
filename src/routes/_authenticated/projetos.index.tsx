import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProjectList } from "@/components/projects/ProjectList";

export const Route = createFileRoute("/_authenticated/projetos/")({
  component: ProjetosPage,
});

function ProjetosPage() {
  return (
    <AppLayout>
      <ProjectList />
    </AppLayout>
  );
}

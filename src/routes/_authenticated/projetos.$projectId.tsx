import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProjectDetail } from "@/components/projects/ProjectDetail";

export const Route = createFileRoute("/_authenticated/projetos/$projectId")({
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  return (
    <AppLayout>
      <ProjectDetail />
    </AppLayout>
  );
}

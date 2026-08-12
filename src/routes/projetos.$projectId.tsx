import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useParams } from "@tanstack/react-router";

export const Route = createFileRoute("/projetos/$projectId")({
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { projectId } = useParams({ from: '/projetos/$projectId' });

  return (
    <AppLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Projeto: {projectId}</h2>
        <p className="text-muted-foreground">Em desenvolvimento...</p>
      </div>
    </AppLayout>
  );
}

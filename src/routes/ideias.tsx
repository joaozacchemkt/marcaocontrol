import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";

export const Route = createFileRoute("/ideias")({
  component: IdeiasPage,
});

function IdeiasPage() {
  return <AppLayout>Ideias</AppLayout>;
}

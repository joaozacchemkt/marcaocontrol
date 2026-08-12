import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";

export const Route = createFileRoute("/contatos")({
  component: ContatosPage,
});

function ContatosPage() {
  return <AppLayout>Contatos</AppLayout>;
}

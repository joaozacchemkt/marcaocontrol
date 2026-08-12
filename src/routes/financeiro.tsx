import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";

export const Route = createFileRoute("/financeiro")({
  component: FinanceiroPage,
});

function FinanceiroPage() {
  return <AppLayout>Financeiro</AppLayout>;
}

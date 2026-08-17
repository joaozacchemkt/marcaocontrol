import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";

export const Route = createFileRoute("/financeiro")({
  component: FinanceiroPage,
});

import { FinanceiroView } from "@/components/financeiro/FinanceiroView";

function FinanceiroPage() {
  return (
    <AppLayout>
      <FinanceiroView />
    </AppLayout>
  );
}

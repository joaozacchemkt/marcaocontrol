import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Marcão Control" },
      { name: "description", content: "Fluxo de caixa com receitas, despesas e vínculo com projetos." },
      { property: "og:title", content: "Financeiro — Marcão Control" },
      { property: "og:description", content: "Fluxo de caixa com receitas, despesas e vínculo com projetos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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

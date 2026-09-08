import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TransactionModal } from "@/components/modals/TransactionModal";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/dates";

interface ProjectFinanceProps {
  project: any;
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export function ProjectFinance({ project }: ProjectFinanceProps) {
  const [activeModal, setActiveModal] = useState<"revenue" | "expense" | null>(null);
  const tx: any[] = project.financial_transactions ?? [];

  const t = useMemo(() => {
    const sum = (pred: (x: any) => boolean) =>
      tx.filter(pred).reduce((acc, x) => acc + Number(x.amount || 0), 0);
    return {
      recebido: sum((x) => x.type === "receita" && x.status === "pago"),
      gasto: sum((x) => x.type === "despesa" && x.status === "pago"),
      aReceber: sum((x) => x.type === "receita" && x.status !== "pago"),
      aPagar: sum((x) => x.type === "despesa" && x.status !== "pago"),
    };
  }, [tx]);

  const resultado = t.recebido - t.gasto;

  const ordered = useMemo(
    () =>
      [...tx].sort((a, b) => {
        const da = parseLocalDate(a.due_date ?? a.date)?.getTime() ?? 0;
        const db = parseLocalDate(b.due_date ?? b.date)?.getTime() ?? 0;
        return db - da;
      }),
    [tx],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Fluxo de caixa do projeto</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-emerald-600"
            onClick={() => setActiveModal("revenue")}
          >
            <TrendingUp className="mr-2 h-4 w-4" /> Receita
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => setActiveModal("expense")}
          >
            <TrendingDown className="mr-2 h-4 w-4" /> Despesa
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="A receber" value={brl(t.aReceber)} tone="pending-in" />
        <SummaryCard label="A pagar" value={brl(t.aPagar)} tone="pending-out" />
        <SummaryCard label="Já recebido" value={brl(t.recebido)} tone="muted" />
        <SummaryCard label="Já gasto" value={brl(t.gasto)} tone="muted" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Resultado realizado (recebido − gasto)</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "text-2xl font-black tabular-nums",
              resultado < 0 ? "text-destructive" : "text-emerald-600",
            )}
          >
            {brl(resultado)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lançamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {ordered.length === 0 ? (
            <p className="py-8 text-center text-sm italic text-muted-foreground">
              Nenhum lançamento neste projeto.
            </p>
          ) : (
            <div className="space-y-2">
              {ordered.map((x) => {
                const when = parseLocalDate(x.due_date ?? x.date);
                return (
                  <div
                    key={x.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "rounded-full p-2",
                          x.type === "receita"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {x.type === "receita" ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{x.description}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {x.category || "Sem categoria"}
                          {when && ` · ${format(when, "dd MMM yyyy", { locale: ptBR })}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                          x.status === "pago"
                            ? "bg-muted text-muted-foreground"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                        )}
                      >
                        {x.status === "pago" ? "pago" : "pendente"}
                      </span>
                      <span
                        className={cn(
                          "tabular-nums font-bold",
                          x.type === "receita" ? "text-emerald-600" : "text-destructive",
                        )}
                      >
                        {x.type === "receita" ? "+" : "−"} {brl(Number(x.amount))}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionModal
        open={activeModal !== null}
        onOpenChange={() => setActiveModal(null)}
        type={activeModal === "revenue" ? "receita" : "despesa"}
        initialProjectId={project.id}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "pending-in" | "pending-out" | "muted";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "mt-1 text-xl font-black tabular-nums",
            tone === "pending-in" && "text-emerald-600",
            tone === "pending-out" && "text-destructive",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

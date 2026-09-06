import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Repeat,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isPast, isToday, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/dates";
import {
  FINANCIAL_FREQUENCY_LABELS,
  MONTHLY_FACTOR,
  advanceFinancialRecurrence,
  type FinancialFrequency,
} from "@/lib/financial-recurrence";
import { TransactionModal } from "@/components/modals/TransactionModal";

type View = "extrato" | "receber" | "pagar" | "recorrencias";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export function FinanceiroView() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("extrato");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [search, setSearch] = useState("");
  const [activeModal, setActiveModal] = useState<"receita" | "despesa" | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["financial_transactions"] });
    queryClient.invalidateQueries({ queryKey: ["financial_pendentes"] });
    queryClient.invalidateQueries({ queryKey: ["financial_recurrences"] });
    queryClient.invalidateQueries({ queryKey: ["financial_totals"] });
    queryClient.invalidateQueries({ queryKey: ["project"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-transactions"] });
  };

  // ---- Queries ----
  const { data: monthTx = [], isLoading: loadingMonth } = useQuery({
    queryKey: ["financial_transactions", format(currentDate, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*, projects(name), contacts(name)")
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"))
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: pendentes = [], isLoading: loadingPend } = useQuery({
    queryKey: ["financial_pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*, projects(name), contacts(name)")
        .eq("status", "pendente")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: recorrencias = [], isLoading: loadingRec } = useQuery({
    queryKey: ["financial_recurrences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_recurrences")
        .select("*, projects(name), contacts(name)")
        .order("active", { ascending: false })
        .order("next_run", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: allTotals } = useQuery({
    queryKey: ["financial_totals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("amount, type, status");
      if (error) throw error;
      return data;
    },
  });

  // ---- Mutations ----
  const toggleStatus = useMutation({
    mutationFn: async (t: any) => {
      const next = t.status === "pago" ? "pendente" : "pago";
      const { error } = await supabase
        .from("financial_transactions")
        .update({ status: next })
        .eq("id", t.id);
      if (error) throw error;
      if (next === "pago" && t.financial_recurrence_id) {
        await advanceFinancialRecurrence(
          t.financial_recurrence_id,
          t.due_date ? String(t.due_date).slice(0, 10) : undefined,
        );
      }
      // Reabrir: desfaz a ocorrência futura que esta quitação havia gerado,
      // para não ficar um lançamento fantasma "a pagar/receber".
      if (next === "pendente" && t.financial_recurrence_id && t.due_date) {
        const dueStr = String(t.due_date).slice(0, 10);
        const { data: successors } = await supabase
          .from("financial_transactions")
          .select("id, due_date")
          .eq("financial_recurrence_id", t.financial_recurrence_id)
          .eq("status", "pendente")
          .gt("due_date", dueStr)
          .order("due_date", { ascending: true });
        const ids = (successors ?? []).map((s) => s.id);
        if (ids.length > 0) {
          await supabase.from("financial_transactions").delete().in("id", ids);
        }
        await supabase
          .from("financial_recurrences")
          .update({ next_run: dueStr })
          .eq("id", t.financial_recurrence_id);
      }
      return next;
    },
    onSuccess: (next) => {
      invalidate();
      toast.success(next === "pago" ? "Quitado." : "Reaberto como pendente.");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Lançamento excluído.");
    },
    onError: (e: Error) => toast.error("Erro ao excluir: " + e.message),
  });

  const toggleRecurrence = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("financial_recurrences")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["financial_recurrences"] }),
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const deleteRecurrence = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_recurrences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Recorrência removida (lançamentos já criados ficam).");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  // ---- Derivados ----
  const receitasMes = monthTx.filter((t) => t.type === "receita").reduce((a, t) => a + t.amount, 0);
  const despesasMes = monthTx.filter((t) => t.type === "despesa").reduce((a, t) => a + t.amount, 0);
  const resultadoMes = receitasMes - despesasMes;

  const aReceber = (allTotals ?? [])
    .filter((t) => t.type === "receita" && t.status === "pendente")
    .reduce((a, t) => a + t.amount, 0);
  const aPagar = (allTotals ?? [])
    .filter((t) => t.type === "despesa" && t.status === "pendente")
    .reduce((a, t) => a + t.amount, 0);

  const monthlyBurn = useMemo(
    () =>
      recorrencias
        .filter((r) => r.active && r.type === "despesa")
        .reduce((a, r) => {
          const factor = MONTHLY_FACTOR[r.frequency as FinancialFrequency] ?? 1;
          const every = Math.max(1, r.interval_count || 1);
          return a + (r.amount * factor) / every;
        }, 0),
    [recorrencias],
  );

  const q = search.trim().toLowerCase();
  const monthFiltered = monthTx.filter((t) => t.description.toLowerCase().includes(q));

  const bucketed = (type: "receita" | "despesa") => {
    const list = pendentes.filter((t) => t.type === type && t.description.toLowerCase().includes(q));
    const vencido: any[] = [];
    const semana: any[] = [];
    const futuro: any[] = [];
    const sem_data: any[] = [];
    for (const t of list) {
      const d = parseLocalDate(t.due_date);
      if (!d) sem_data.push(t);
      else if (isPast(d) && !isToday(d)) vencido.push(t);
      else if (differenceInCalendarDays(d, new Date()) <= 7) semana.push(t);
      else futuro.push(t);
    }
    return { vencido, semana, futuro, sem_data };
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Financeiro</h2>
          <p className="text-muted-foreground">Contas a receber, a pagar, recorrências e fluxo do mês.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700"
            onClick={() => setActiveModal("receita")}
          >
            <ArrowUpRight className="mr-2 h-4 w-4" /> Receita
          </Button>
          <Button
            variant="outline"
            className="text-destructive border-destructive/20 bg-destructive/5 hover:bg-destructive/10"
            onClick={() => setActiveModal("despesa")}
          >
            <ArrowDownLeft className="mr-2 h-4 w-4" /> Despesa
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="A receber" value={brl(aReceber)} tone="good" icon={<ArrowUpRight className="h-4 w-4" />} />
        <SummaryCard label="A pagar" value={brl(aPagar)} tone="bad" icon={<ArrowDownLeft className="h-4 w-4" />} />
        <SummaryCard label="Resultado do mês" value={brl(resultadoMes)} tone={resultadoMes >= 0 ? "neutral" : "warn"} icon={<Wallet className="h-4 w-4" />} />
        <SummaryCard label="Compromisso mensal fixo" value={brl(monthlyBurn)} tone="neutral" icon={<Repeat className="h-4 w-4" />} />
      </div>

      {/* Navegação de seções */}
      <div className="flex flex-wrap gap-1.5 border-b pb-2">
        {(
          [
            ["extrato", "Extrato do mês"],
            ["receber", "A receber"],
            ["pagar", "A pagar"],
            ["recorrencias", "Recorrências & Assinaturas"],
          ] as [View, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              view === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {view !== "recorrencias" && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* ---- Extrato ---- */}
      {view === "extrato" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 border-b pb-3">
            <div className="flex items-center rounded-lg border p-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[130px] px-3 text-center text-sm font-bold capitalize">
                {format(currentDate, "MMMM yyyy", { locale: ptBR })}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-4 text-xs">
              <span className="text-emerald-600">
                <TrendingUp className="mr-1 inline h-3 w-3" />
                {brl(receitasMes)}
              </span>
              <span className="text-destructive">
                <TrendingDown className="mr-1 inline h-3 w-3" />
                {brl(despesasMes)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingMonth ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : monthFiltered.length === 0 ? (
              <p className="p-10 text-center text-sm italic text-muted-foreground">Nada neste mês.</p>
            ) : (
              <ul className="divide-y">
                {monthFiltered.map((t) => (
                  <TxRow
                    key={t.id}
                    t={t}
                    busy={toggleStatus.isPending}
                    onToggle={() => toggleStatus.mutate(t)}
                    onEdit={() => setEditingTransaction(t)}
                    onDelete={() => deleteTransaction.mutate(t.id)}
                    showDate
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---- A receber / A pagar ---- */}
      {(view === "receber" || view === "pagar") && (
        <div className="space-y-5">
          {loadingPend ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            (() => {
              const type = view === "receber" ? "receita" : "despesa";
              const g = bucketed(type);
              const total = Object.values(g).flat().length;
              if (total === 0) {
                return (
                  <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                    {view === "receber" ? "Ninguém te devendo." : "Nada a pagar em aberto."}
                  </div>
                );
              }
              return (
                <>
                  <BucketGroup title="Vencido" tone="bad" items={g.vencido} busy={toggleStatus.isPending} onToggle={toggleStatus} onEdit={setEditingTransaction} onDelete={deleteTransaction} />
                  <BucketGroup title="Vence em até 7 dias" tone="warn" items={g.semana} busy={toggleStatus.isPending} onToggle={toggleStatus} onEdit={setEditingTransaction} onDelete={deleteTransaction} />
                  <BucketGroup title="Mais pra frente" tone="neutral" items={g.futuro} busy={toggleStatus.isPending} onToggle={toggleStatus} onEdit={setEditingTransaction} onDelete={deleteTransaction} />
                  <BucketGroup title="Sem data de vencimento" tone="neutral" items={g.sem_data} busy={toggleStatus.isPending} onToggle={toggleStatus} onEdit={setEditingTransaction} onDelete={deleteTransaction} />
                </>
              );
            })()
          )}
        </div>
      )}

      {/* ---- Recorrências ---- */}
      {view === "recorrencias" && (
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm font-bold">
              Recorrências ativas — sai/entra todo mês, sem você lançar de novo
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Ao marcar o lançamento atual como pago, o próximo é criado sozinho na data certa.
              Para criar: use "Receita" ou "Despesa" acima e marque "repete".
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {loadingRec ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : recorrencias.length === 0 ? (
              <p className="p-10 text-center text-sm italic text-muted-foreground">
                Nenhuma recorrência. Aluguel, salário, assinatura, parcela — cadastre uma vez.
              </p>
            ) : (
              <ul className="divide-y">
                {recorrencias.map((r) => (
                  <li key={r.id} className={cn("flex items-center gap-3 p-4", !r.active && "opacity-50")}>
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        r.type === "receita" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive",
                      )}
                    >
                      <Repeat className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{r.description}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <Badge variant="secondary" className="text-[10px]">
                          {FINANCIAL_FREQUENCY_LABELS[r.frequency as FinancialFrequency] ?? r.frequency}
                        </Badge>
                        {r.category && <span>{r.category}</span>}
                        {(r as any).projects?.name && <span>· {(r as any).projects.name}</span>}
                        {r.active && (
                          <span>
                            · próximo{" "}
                            {r.next_run ? format(parseLocalDate(r.next_run)!, "dd/MM/yyyy") : "—"}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-black",
                        r.type === "receita" ? "text-emerald-600" : "text-destructive",
                      )}
                    >
                      {r.type === "receita" ? "+" : "-"} {brl(r.amount)}
                    </span>
                    <Switch
                      checked={r.active}
                      aria-label="Recorrência ativa"
                      onCheckedChange={(active) => toggleRecurrence.mutate({ id: r.id, active })}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label="Remover recorrência">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover recorrência?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{r.description}" para de gerar novos lançamentos. Os que já existem continuam.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteRecurrence.mutate(r.id)}>Remover</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <TransactionModal
        open={activeModal !== null}
        onOpenChange={(o) => !o && setActiveModal(null)}
        type={activeModal || "receita"}
      />
      <TransactionModal
        open={editingTransaction !== null}
        onOpenChange={(o) => !o && setEditingTransaction(null)}
        type={(editingTransaction?.type as "receita" | "despesa") || "receita"}
        transaction={editingTransaction}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "good" | "bad" | "warn" | "neutral";
  icon: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[11px] font-bold uppercase tracking-wide">{label}</span>
          <span
            className={cn(
              tone === "good" && "text-emerald-600",
              tone === "bad" && "text-destructive",
              tone === "warn" && "text-amber-500",
            )}
          >
            {icon}
          </span>
        </div>
        <p
          className={cn(
            "mt-1 text-xl font-black tabular-nums",
            tone === "good" && "text-emerald-600",
            tone === "bad" && "text-destructive",
            tone === "warn" && "text-amber-600",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function BucketGroup({
  title,
  tone,
  items,
  onToggle,
  onEdit,
  onDelete,
  busy,
}: {
  title: string;
  tone: "bad" | "warn" | "neutral";
  items: any[];
  onToggle: { mutate: (t: any) => void };
  onEdit: (t: any) => void;
  onDelete: { mutate: (id: string) => void };
  busy?: boolean;
}) {
  if (items.length === 0) return null;
  const subtotal = items.reduce((a, t) => a + t.amount, 0);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <h4
          className={cn(
            "text-xs font-bold uppercase tracking-wide",
            tone === "bad" && "text-destructive",
            tone === "warn" && "text-amber-600",
            tone === "neutral" && "text-muted-foreground",
          )}
        >
          {title} <span className="font-normal">({items.length})</span>
        </h4>
        <span className="text-xs font-bold tabular-nums text-muted-foreground">{brl(subtotal)}</span>
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {items.map((t) => (
          <TxRow
            key={t.id}
            t={t}
            busy={!!busy}
            onToggle={() => onToggle.mutate(t)}
            onEdit={() => onEdit(t)}
            onDelete={() => onDelete.mutate(t.id)}
            showDue
          />
        ))}
      </ul>
    </div>
  );
}

function TxRow({
  t,
  onToggle,
  onEdit,
  onDelete,
  showDate,
  showDue,
  busy,
}: {
  t: any;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  showDate?: boolean;
  showDue?: boolean;
  busy?: boolean;
}) {
  const due = parseLocalDate(t.due_date);
  const overdue = due && isPast(due) && !isToday(due) && t.status === "pendente";
  return (
    <li className="flex items-center gap-3 p-3">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          t.type === "receita" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive",
        )}
      >
        {t.type === "receita" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-bold">{t.description}</p>
          {t.financial_recurrence_id && <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" />}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {t.category && <span>{t.category}</span>}
          {t.contacts?.name && <span>· {t.contacts.name}</span>}
          {t.projects?.name && <span>· {t.projects.name}</span>}
          {showDate && <span>· {format(parseLocalDate(t.date)!, "dd/MM")}</span>}
          {showDue && t.due_date && (
            <span className={cn(overdue && "font-bold text-destructive")}>
              · vence {format(due!, "dd/MM/yyyy")}
            </span>
          )}
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 text-sm font-black tabular-nums",
          t.type === "receita" ? "text-emerald-600" : "text-destructive",
        )}
      >
        {t.type === "receita" ? "+" : "-"} {brl(t.amount)}
      </span>
      <div className="flex shrink-0 items-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={busy}
          title={t.status === "pago" ? "Reabrir" : t.type === "receita" ? "Marcar recebido" : "Marcar pago"}
          aria-label={t.status === "pago" ? "Reabrir" : "Marcar quitado"}
          onClick={onToggle}
        >
          {t.status === "pago" ? (
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          )}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label="Excluir">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
              <AlertDialogDescription>
                "{t.description}" some do fluxo de caixa. Não dá pra desfazer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}

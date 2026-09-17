import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ReminderModal, type ReminderRow } from "@/components/modals/ReminderModal";
import { advanceReminderRecurrence, invalidateReminders } from "@/lib/reminders";
import { Bell, Check, Clock, Pencil, Plus, Repeat, RotateCcw, Search, Trash2 } from "lucide-react";
import { format, isPast, isToday, startOfDay, endOfDay, addDays, addHours, addWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lembretes")({
  head: () => ({
    meta: [
      { title: "Lembretes — Marcão Control" },
      { name: "description", content: "Lembretes com data e hora, avulsos ou ligados a um projeto." },
      { property: "og:title", content: "Lembretes — Marcão Control" },
      { property: "og:description", content: "Lembretes com data e hora, avulsos ou ligados a um projeto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LembretesPage,
});

interface Row extends ReminderRow {
  user_id: string;
  channel: string;
  projects?: { name: string } | null;
}

const SEL =
  "id, title, remind_at, project_id, notes, entity_type, entity_id, status, user_id, channel, priority, category, recurrence_frequency, recurrence_interval, recurrence_end_date, projects(name)";

const PRIORITY_LABEL: Record<Row["priority"], string> = { alta: "Alta", media: "Média", baixa: "Baixa" };

function LembretesPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"todas" | "alta" | "media" | "baixa">("todas");
  const [categoryFilter, setCategoryFilter] = useState("todas");

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["reminders-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select(SEL)
        .eq("status", "pendente")
        .order("remind_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  // Resolvidos recentes: só os últimos 60 dias e no máximo 50 — não cresce sem limite.
  // Buscar mais que isso é papel da busca (histórico completo, sem esse corte).
  const { data: resolvedRecent = [] } = useQuery({
    queryKey: ["reminders-resolved"],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 60 * 86400000).toISOString();
      const { data, error } = await supabase
        .from("reminders")
        .select(SEL)
        .eq("status", "enviado")
        .gte("updated_at", cutoff)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const trimmedSearch = search.trim();

  const { data: historySearch = [] } = useQuery({
    queryKey: ["reminders-history-search", trimmedSearch],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select(SEL)
        .eq("status", "enviado")
        .ilike("title", `%${trimmedSearch}%`)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
    enabled: trimmedSearch.length > 0,
  });

  const resolved = trimmedSearch ? historySearch : resolvedRecent;

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of [...pending, ...resolvedRecent]) if (r.category) set.add(r.category);
    return Array.from(set).sort();
  }, [pending, resolvedRecent]);

  const reminders = useMemo(() => {
    const term = trimmedSearch.toLowerCase();
    return [...pending, ...resolved].filter((r) => {
      if (priorityFilter !== "todas" && r.priority !== priorityFilter) return false;
      if (categoryFilter !== "todas" && r.category !== categoryFilter) return false;
      if (!term) return true;
      return r.title.toLowerCase().includes(term) || (r.notes ?? "").toLowerCase().includes(term);
    });
  }, [pending, resolved, trimmedSearch, priorityFilter, categoryFilter]);

  const setStatus = useMutation({
    mutationFn: async ({ row, status }: { row: Row; status: "pendente" | "enviado" }) => {
      const { error } = await supabase.from("reminders").update({ status }).eq("id", row.id);
      if (error) throw error;
      if (status === "enviado" && row.recurrence_frequency) {
        await advanceReminderRecurrence(row);
      }
    },
    onSuccess: (_d, v) => {
      invalidateReminders(queryClient);
      queryClient.invalidateQueries({ queryKey: ["reminders-history-search"] });
      toast.success(v.status === "enviado" ? "Lembrete concluído" : "Lembrete reaberto");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const snooze = useMutation({
    mutationFn: async ({ id, remindAt }: { id: string; remindAt: Date }) => {
      const { error } = await supabase
        .from("reminders")
        .update({ remind_at: remindAt.toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateReminders(queryClient);
      toast.success("Lembrete adiado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reminders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateReminders(queryClient);
      toast.success("Lembrete excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (row: Row) => {
    setEditing(row);
    setModalOpen(true);
  };

  const groups = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekEnd = endOfDay(addDays(now, 7));
    const g = {
      atrasados: [] as Row[],
      hoje: [] as Row[],
      semana: [] as Row[],
      depois: [] as Row[],
      resolvidos: [] as Row[],
    };
    for (const r of reminders) {
      if (r.status === "enviado") {
        g.resolvidos.push(r);
        continue;
      }
      const d = new Date(r.remind_at);
      if (Number.isNaN(d.getTime())) {
        g.depois.push(r);
      } else if (isToday(d)) {
        g.hoje.push(r);
      } else if (d < todayStart) {
        g.atrasados.push(r);
      } else if (d <= weekEnd) {
        g.semana.push(r);
      } else {
        g.depois.push(r);
      }
    }
    return g;
  }, [reminders]);

  const pendingCount =
    groups.atrasados.length + groups.hoje.length + groups.semana.length + groups.depois.length;
  const filtersActive = trimmedSearch !== "" || priorityFilter !== "todas" || categoryFilter !== "todas";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Bell className="h-6 w-6 text-primary" /> Lembretes
            </h2>
            <p className="text-muted-foreground">
              {pendingCount === 0
                ? "Nenhum lembrete pendente."
                : `${pendingCount} ${pendingCount === 1 ? "lembrete pendente" : "lembretes pendentes"}.`}
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Novo lembrete
          </Button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por título ou observação (inclui histórico inteiro)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as typeof priorityFilter)}>
            <SelectTrigger className="sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Toda prioridade</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
          {categories.length > 0 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Toda categoria</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-accent" />
            ))}
          </div>
        ) : pendingCount === 0 && groups.resolvidos.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed py-16 text-center text-muted-foreground">
            {filtersActive
              ? "Nenhum lembrete encontrado com esses filtros."
              : "Nenhum lembrete ainda. Crie um com data e hora — avulso ou ligado a um projeto."}
          </div>
        ) : (
          <div className="space-y-6">
            <Section title="Atrasados" tone="bad" rows={groups.atrasados} onDone={setStatus} onSnooze={snooze} onEdit={openEdit} onRemove={remove} />
            <Section title="Hoje" tone="warn" rows={groups.hoje} onDone={setStatus} onSnooze={snooze} onEdit={openEdit} onRemove={remove} />
            <Section title="Próximos 7 dias" tone="neutral" rows={groups.semana} onDone={setStatus} onSnooze={snooze} onEdit={openEdit} onRemove={remove} />
            <Section title="Depois" tone="neutral" rows={groups.depois} onDone={setStatus} onSnooze={snooze} onEdit={openEdit} onRemove={remove} />
            <Section
              title={trimmedSearch ? "Histórico (resultado da busca)" : "Resolvidos"}
              tone="muted"
              rows={groups.resolvidos}
              onDone={setStatus}
              onSnooze={snooze}
              onEdit={openEdit}
              onRemove={remove}
              resolved
            />
          </div>
        )}
      </div>

      <ReminderModal
        open={modalOpen}
        onOpenChange={(o) => {
          setModalOpen(o);
          if (!o) setEditing(null);
        }}
        reminder={editing}
      />
    </AppLayout>
  );
}

function Section({
  title,
  tone,
  rows,
  resolved = false,
  onDone,
  onSnooze,
  onEdit,
  onRemove,
}: {
  title: string;
  tone: "bad" | "warn" | "neutral" | "muted";
  rows: Row[];
  resolved?: boolean;
  onDone: { mutate: (v: { row: Row; status: "pendente" | "enviado" }) => void };
  onSnooze: { mutate: (v: { id: string; remindAt: Date }) => void };
  onEdit: (row: Row) => void;
  onRemove: { mutate: (id: string) => void };
}) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <h3
          className={cn(
            "text-xs font-bold uppercase tracking-wide",
            tone === "bad" && "text-destructive",
            tone === "warn" && "text-amber-600 dark:text-amber-400",
            (tone === "neutral" || tone === "muted") && "text-muted-foreground",
          )}
        >
          {title}
        </h3>
        <span className="text-xs text-muted-foreground">{rows.length}</span>
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {rows.map((r) => {
          const d = new Date(r.remind_at);
          const valid = !Number.isNaN(d.getTime());
          const overdue = valid && isPast(d) && !isToday(d) && !resolved;
          const dueToday = valid && isToday(d) && !resolved;
          return (
            <li
              key={r.id}
              className={cn(
                "flex items-center gap-3 border-l-4 border-l-transparent px-3 py-2.5",
                resolved && "border-l-emerald-500 bg-emerald-500/5",
                overdue && "border-l-destructive bg-destructive/5",
                dueToday && "border-l-amber-500 bg-amber-500/5",
              )}
            >
              <button
                type="button"
                aria-label={resolved ? "Reabrir lembrete" : "Concluir lembrete"}
                title={resolved ? "Reabrir" : "Concluir"}
                onClick={() =>
                  onDone.mutate({ row: r, status: resolved ? "pendente" : "enviado" })
                }
                className={cn(
                  "shrink-0 rounded-full p-1 transition-colors",
                  resolved
                    ? "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                    : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                )}
              >
                {resolved ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              </button>

              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-medium", resolved && "text-muted-foreground line-through")}>
                  {r.title}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-[11px] text-muted-foreground">
                  <span
                    className={cn(
                      overdue && "font-semibold text-destructive",
                      dueToday && "font-semibold text-amber-600 dark:text-amber-400",
                      resolved && "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {valid ? format(d, "dd MMM yyyy · HH:mm", { locale: ptBR }) : "Sem data"}
                  </span>
                  {r.priority !== "media" && (
                    <Badge
                      variant={r.priority === "alta" ? "destructive" : "outline"}
                      className="h-4 px-1.5 py-0 text-[9px]"
                    >
                      {PRIORITY_LABEL[r.priority]}
                    </Badge>
                  )}
                  {r.category && (
                    <Badge variant="secondary" className="h-4 px-1.5 py-0 text-[9px]">
                      {r.category}
                    </Badge>
                  )}
                  {r.recurrence_frequency && (
                    <span className="flex items-center gap-0.5" title="Lembrete recorrente">
                      <Repeat className="h-3 w-3" />
                    </span>
                  )}
                  {r.projects?.name && r.project_id && (
                    <Link
                      to="/projetos/$projectId"
                      params={{ projectId: r.project_id }}
                      className="rounded bg-muted px-1.5 py-0.5 font-bold uppercase hover:text-foreground"
                    >
                      {r.projects.name}
                    </Link>
                  )}
                  {r.entity_type === "task" && (
                    <Badge variant="outline" className="h-4 px-1.5 py-0 text-[9px]">
                      tarefa
                    </Badge>
                  )}
                </div>
              </div>

              {!resolved && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Adiar lembrete"
                      title="Adiar"
                      className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Clock className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onSnooze.mutate({ id: r.id, remindAt: addHours(new Date(), 1) })}>
                      +1 hora
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSnooze.mutate({ id: r.id, remindAt: addDays(d, 1) })}>
                      Amanhã (mesma hora)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSnooze.mutate({ id: r.id, remindAt: addWeeks(d, 1) })}>
                      Próxima semana
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {!resolved && (
                <button
                  type="button"
                  aria-label="Editar lembrete"
                  onClick={() => onEdit(r)}
                  className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    aria-label="Excluir lembrete"
                    className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir lembrete?</AlertDialogTitle>
                    <AlertDialogDescription>
                      "{r.title}" será removido. A ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onRemove.mutate(r.id)}>Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

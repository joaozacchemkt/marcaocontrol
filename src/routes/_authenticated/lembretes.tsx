import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { invalidateReminders } from "@/lib/reminders";
import { Bell, Check, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { format, isPast, isToday, startOfDay, endOfDay, addDays } from "date-fns";
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
  projects?: { name: string } | null;
}

function LembretesPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ["reminders-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("id, title, remind_at, project_id, notes, entity_type, entity_id, status, projects(name)")
        .neq("status", "cancelado")
        .order("remind_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "pendente" | "enviado" }) => {
      const { error } = await supabase.from("reminders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      invalidateReminders(queryClient);
      toast.success(v.status === "enviado" ? "Lembrete concluído" : "Lembrete reaberto");
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

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-accent" />
            ))}
          </div>
        ) : pendingCount === 0 && groups.resolvidos.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed py-16 text-center text-muted-foreground">
            Nenhum lembrete ainda. Crie um com data e hora — avulso ou ligado a um projeto.
          </div>
        ) : (
          <div className="space-y-6">
            <Section title="Atrasados" tone="bad" rows={groups.atrasados} onDone={setStatus} onEdit={openEdit} onRemove={remove} />
            <Section title="Hoje" tone="warn" rows={groups.hoje} onDone={setStatus} onEdit={openEdit} onRemove={remove} />
            <Section title="Próximos 7 dias" tone="neutral" rows={groups.semana} onDone={setStatus} onEdit={openEdit} onRemove={remove} />
            <Section title="Depois" tone="neutral" rows={groups.depois} onDone={setStatus} onEdit={openEdit} onRemove={remove} />
            <Section title="Resolvidos" tone="muted" rows={groups.resolvidos} onDone={setStatus} onEdit={openEdit} onRemove={remove} resolved />
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
  onEdit,
  onRemove,
}: {
  title: string;
  tone: "bad" | "warn" | "neutral" | "muted";
  rows: Row[];
  resolved?: boolean;
  onDone: { mutate: (v: { id: string; status: "pendente" | "enviado" }) => void };
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
          return (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
              <button
                type="button"
                aria-label={resolved ? "Reabrir lembrete" : "Concluir lembrete"}
                title={resolved ? "Reabrir" : "Concluir"}
                onClick={() =>
                  onDone.mutate({ id: r.id, status: resolved ? "pendente" : "enviado" })
                }
                className={cn(
                  "shrink-0 rounded-full p-1 transition-colors",
                  resolved
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                )}
              >
                {resolved ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              </button>

              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-medium", resolved && "text-muted-foreground line-through")}>
                  {r.title}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span className={cn(overdue && "font-semibold text-destructive")}>
                    {valid ? format(d, "dd MMM yyyy · HH:mm", { locale: ptBR }) : "Sem data"}
                  </span>
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

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  AlertTriangle,
  MessageSquare,
  ListTodo,
  CalendarClock,
  Bell,
  Target,
} from "lucide-react";
import { format, isPast, isToday, isThisWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/dates";
import { ProjectRelations } from "./ProjectRelations";

interface ProjectPainelProps {
  project: any;
  /** Troca a aba do projeto (ex.: "tarefas"). Opcional. */
  onNavigate?: (tab: string) => void;
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export function ProjectPainel({ project, onNavigate }: ProjectPainelProps) {
  // Só cards de topo — subtarefas não contam nos números do painel
  // (a aba Tarefas também conta só os pais).
  const tasks: any[] = (project.tasks ?? []).filter((t: any) => !t.parent_task_id);
  const tx: any[] = project.financial_transactions ?? [];

  const open = tasks.filter((t) => t.status !== "concluido");
  // Pendências em aberto ordenadas: com prazo primeiro (mais próximo antes),
  // depois as sem prazo. Mostra as 6 primeiras no painel.
  const openSorted = [...open].sort((a, b) => {
    const da = a.deadline ? parseLocalDate(a.deadline)!.getTime() : Infinity;
    const db = b.deadline ? parseLocalDate(b.deadline)!.getTime() : Infinity;
    return da - db;
  });
  const topOpen = openSorted.slice(0, 6);
  const overdue = open.filter(
    (t) => t.deadline && isPast(parseLocalDate(t.deadline)!) && !isToday(parseLocalDate(t.deadline)!),
  );
  const waiting = open.filter((t) => t.status === "aguardando_terceiro");
  const done = tasks.filter((t) => t.status === "concluido").length;
  const progress = tasks.length > 0 ? (done / tasks.length) * 100 : 0;

  const nextTask = [...open]
    .filter((t) => t.deadline)
    .sort((a, b) => parseLocalDate(a.deadline)!.getTime() - parseLocalDate(b.deadline)!.getTime())[0];
  const nextAction = project.next_action?.trim() || nextTask?.title || null;

  const aReceber = tx
    .filter((t) => t.type === "receita" && t.status === "pendente")
    .reduce((a, t) => a + t.amount, 0);
  const aPagar = tx
    .filter((t) => t.type === "despesa" && t.status === "pendente")
    .reduce((a, t) => a + t.amount, 0);
  const recebido = tx
    .filter((t) => t.type === "receita" && t.status === "pago")
    .reduce((a, t) => a + t.amount, 0);
  const gasto = tx
    .filter((t) => t.type === "despesa" && t.status === "pago")
    .reduce((a, t) => a + t.amount, 0);
  const hasFinance = tx.length > 0;

  const { data: nextEvents = [] } = useQuery({
    queryKey: ["project-next-events", project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, start_time, location")
        .eq("project_id", project.id)
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: projectReminders = [] } = useQuery({
    queryKey: ["today-reminders", "project", project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("id, title, remind_at")
        .eq("project_id", project.id)
        .eq("status", "pendente")
        .order("remind_at", { ascending: true })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      {/* Números que importam */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat icon={<ListTodo className="h-4 w-4" />} label="Em aberto" value={String(open.length)} />
        <Stat
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Atrasadas"
          value={String(overdue.length)}
          tone={overdue.length > 0 ? "danger" : undefined}
        />
        <Stat
          icon={<MessageSquare className="h-4 w-4" />}
          label="Aguardando terceiros"
          value={String(waiting.length)}
          tone={waiting.length > 0 ? "warning" : undefined}
        />
        <Stat
          icon={<Target className="h-4 w-4" />}
          label="Progresso"
          value={`${Math.round(progress)}%`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coluna principal */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Objetivo &amp; próxima ação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {project.objective || "Sem objetivo definido — use \"Editar Projeto\"."}
              </p>
              <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
                  Próxima ação
                </p>
                <p className="mt-0.5 flex items-center gap-2 text-sm font-medium">
                  <ArrowRight className="h-4 w-4 text-primary" />
                  {nextAction || "Defina o próximo passo."}
                  {nextTask?.deadline && !project.next_action?.trim() && (
                    <span className="text-xs text-muted-foreground">
                      · {format(parseLocalDate(nextTask.deadline)!, "dd MMM", { locale: ptBR })}
                    </span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListTodo className="h-4 w-4 text-primary" /> Pendências em aberto
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  {open.length}
                </Badge>
              </CardTitle>
              {onNavigate && open.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onNavigate("tarefas")}
                >
                  Ver todas <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {topOpen.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma pendência em aberto.</p>
              ) : (
                <ul className="space-y-1.5">
                  {topOpen.map((t) => {
                    const dl = parseLocalDate(t.deadline);
                    const late =
                      dl && isPast(dl) && !isToday(dl) && t.status !== "concluido";
                    const rowInner = (
                      <>
                        <span className="min-w-0 flex-1 truncate">
                          {t.title}
                          {t.status === "aguardando_terceiro" && (
                            <span className="ml-1.5 text-[10px] font-medium uppercase text-amber-600 dark:text-amber-400">
                              · aguardando
                            </span>
                          )}
                        </span>
                        {t.priority === "alta" && (
                          <span className="shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-destructive">
                            alta
                          </span>
                        )}
                        {dl && (
                          <span
                            className={cn(
                              "shrink-0 text-xs",
                              late ? "font-semibold text-destructive" : "text-muted-foreground",
                            )}
                          >
                            {format(dl, "dd MMM", { locale: ptBR })}
                          </span>
                        )}
                      </>
                    );
                    return (
                      <li key={t.id}>
                        {onNavigate ? (
                          <button
                            type="button"
                            onClick={() => onNavigate("tarefas")}
                            className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
                          >
                            {rowInner}
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                            {rowInner}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-primary" /> Próximos compromissos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nextEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nada agendado para este projeto.</p>
              ) : (
                <ul className="space-y-2">
                  {nextEvents.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{e.title}</p>
                        {e.location && (
                          <p className="truncate text-[11px] text-muted-foreground">{e.location}</p>
                        )}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-md border bg-background px-2 py-1 text-[11px] font-bold",
                          isThisWeek(new Date(e.start_time), { weekStartsOn: 1 }) && "text-primary",
                        )}
                      >
                        {format(new Date(e.start_time), "dd/MM HH:mm")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {projectReminders.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="h-4 w-4 text-primary" /> Lembretes deste projeto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {projectReminders.map((r) => {
                    const d = new Date(r.remind_at);
                    const late = isPast(d) && !isToday(d);
                    return (
                      <li
                        key={r.id}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-lg border px-3 py-2",
                          late && "border-destructive/30 bg-destructive/5",
                        )}
                      >
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">{r.title}</p>
                        <span
                          className={cn(
                            "shrink-0 text-[11px] font-bold",
                            late ? "text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {format(d, "dd/MM HH:mm")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {project.description && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Descrição</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {project.description}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Coluna lateral */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Prazo &amp; status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-lg font-bold">
                  {project.deadline
                    ? format(parseLocalDate(project.deadline)!, "dd 'de' MMM, yyyy", { locale: ptBR })
                    : "Sem prazo definido"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {project.start_date
                    ? `Início: ${format(parseLocalDate(project.start_date)!, "dd/MM/yyyy")}`
                    : "Início não informado"}
                </p>
              </div>
              <Progress value={progress} className="h-1.5" />
              <Badge variant="secondary" className="w-full justify-center py-1 capitalize">
                {String(project.status ?? "").replace(/_/g, " ") || "sem status"}
              </Badge>
            </CardContent>
          </Card>

          {hasFinance && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Financeiro do projeto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="A receber" value={brl(aReceber)} className="text-emerald-600" />
                <Row label="A pagar" value={brl(aPagar)} className="text-destructive" />
                <div className="my-1 border-t border-dashed" />
                <Row label="Já recebido" value={brl(recebido)} muted />
                <Row label="Já gasto" value={brl(gasto)} muted />
                <div className="my-1 border-t border-dashed" />
                <Row
                  label="Resultado"
                  value={brl(recebido - gasto)}
                  className={recebido - gasto < 0 ? "text-destructive" : "text-emerald-600"}
                  bold
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ProjectRelations projectId={project.id} />
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "danger" | "warning" | undefined;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
          <span
            className={cn(
              tone === "danger" && "text-destructive",
              tone === "warning" && "text-amber-500",
            )}
          >
            {icon}
          </span>
        </div>
        <p className="mt-1 text-xl font-black tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  className,
  muted,
  bold,
}: {
  label: string;
  value: string;
  className?: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn(muted ? "text-muted-foreground" : "text-foreground")}>{label}</span>
      <span className={cn("tabular-nums", bold ? "font-black" : "font-semibold", className)}>
        {value}
      </span>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { invalidateReminders } from "@/lib/reminders";
import {
  Check,
  CheckCircle2,
  MessageSquare,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Bell,
} from "lucide-react";
import { format, isPast, isToday, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { parseLocalDate, localDateTime } from "@/lib/dates";
import { EstudarAgora } from "@/components/projects/workspace/faculdade/EstudarAgora";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Marcão Control" },
      { name: "description", content: "O que fazer agora: prioridades do dia, quem você está esperando e o que precisa de atenção." },
      { property: "og:title", content: "Dashboard — Marcão Control" },
      { property: "og:description", content: "O que fazer agora: prioridades do dia, quem você está esperando e o que precisa de atenção." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);

function Dashboard() {
  const queryClient = useQueryClient();

  const concluirLembrete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reminders").update({ status: "enviado" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateReminders(queryClient);
      toast.success("Lembrete concluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['dashboard-projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*, tasks(*), academic_subjects(*)');
      return data || [];
    }
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['dashboard-tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*, projects(name)').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['dashboard-transactions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_transactions')
        .select('*, projects(name)');
      return data || [];
    }
  });

  const { data: academicExams = [] } = useQuery({
    queryKey: ['dashboard-exams'],
    queryFn: async () => {
      const { data } = await supabase.from('academic_exams').select('*, academic_subjects(name, project_id)');
      return data || [];
    }
  });

  const { data: academicAssignments = [] } = useQuery({
    queryKey: ['dashboard-assignments'],
    queryFn: async () => {
      const { data } = await supabase.from('academic_assignments').select('*, academic_subjects(name, project_id)');
      return data || [];
    }
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ['today-reminders'],
    queryFn: async () => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const { data } = await supabase
        .from('reminders')
        .select('id, title, remind_at, entity_id, project_id')
        .eq('status', 'pendente')
        .lte('remind_at', end.toISOString())
        .order('remind_at', { ascending: true });
      return data || [];
    },
    refetchInterval: 1000 * 60 * 5,
  });

  const dateStr = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Cálculos Reais
  const activeProjectsCount = projects.filter(p => p.status !== 'concluido' && p.status !== 'pausado').length;
  const pendingTasksCount = tasks.filter(t => t.status !== 'concluido').length;

  const pendentesReceita = transactions.filter(t => t.type === 'receita' && t.status === 'pendente');
  const pendentesDespesa = transactions.filter(t => t.type === 'despesa' && t.status === 'pendente');

  const aReceber = pendentesReceita.reduce((acc, t) => acc + t.amount, 0);
  const aPagar = pendentesDespesa.reduce((acc, t) => acc + t.amount, 0);

  // Ordena pendentes por vencimento (sem data vai pro fim).
  const byDue = (a: any, b: any) => {
    const da = a.due_date ? parseLocalDate(a.due_date)!.getTime() : Infinity;
    const db = b.due_date ? parseLocalDate(b.due_date)!.getTime() : Infinity;
    return da - db;
  };
  const contasAPagar = [...pendentesDespesa].sort(byDue);
  const contasAReceber = [...pendentesReceita].sort(byDue);
  const isBillLate = (t: any) =>
    t.due_date && isPast(parseLocalDate(t.due_date)!) && !isToday(parseLocalDate(t.due_date)!);
  const pagarVencido = contasAPagar.filter(isBillLate).reduce((a, t) => a + t.amount, 0);

  // Realizado no mês corrente (o que efetivamente entrou/saiu).
  const now = new Date();
  const inThisMonth = (t: any) => {
    const d = parseLocalDate(t.date ?? t.due_date);
    return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };
  const entrouMes = transactions
    .filter(t => t.type === 'receita' && t.status === 'pago' && inThisMonth(t))
    .reduce((a, t) => a + t.amount, 0);
  const saiuMes = transactions
    .filter(t => t.type === 'despesa' && t.status === 'pago' && inThisMonth(t))
    .reduce((a, t) => a + t.amount, 0);

  // O que fazer agora: tarefas + provas + trabalhos, tudo na mesma régua de prioridade.
  const allPriorities = ([
    ...tasks.filter(t => t.status !== 'concluido').map(t => ({ ...t, type: 'task', projectId: t.project_id })),
    ...academicExams.filter(e => e.status !== 'corrigida').map(e => ({
      ...e,
      id: e.id,
      title: `Prova: ${e.title}`,
      deadline: e.date,
      priority: 'alta' as const,
      projects: { name: (e as any).academic_subjects?.name },
      type: 'exam',
      status: e.status || 'a_estudar',
      projectId: (e as any).academic_subjects?.project_id ?? null,
    })),
    ...academicAssignments.filter(a => a.status !== 'corrigido').map(a => ({
      ...a,
      id: a.id,
      title: `Trabalho: ${a.title}`,
      deadline: a.deadline,
      priority: 'media' as const,
      projects: { name: (a as any).academic_subjects?.name },
      type: 'assignment',
      status: a.status || 'nao_iniciado',
      projectId: a.project_id ?? (a as any).academic_subjects?.project_id ?? null,
    }))
  ] as any[])
    .sort((a, b) => {
      const isOverdueA = a.deadline && isPast(parseLocalDate(a.deadline)) && !isToday(parseLocalDate(a.deadline)) ? 1 : 0;
      const isOverdueB = b.deadline && isPast(parseLocalDate(b.deadline)) && !isToday(parseLocalDate(b.deadline)) ? 1 : 0;
      if (isOverdueA !== isOverdueB) return isOverdueB - isOverdueA;

      const priorityWeight = { alta: 3, media: 2, baixa: 1 };
      const weightA = priorityWeight[a.priority as keyof typeof priorityWeight] || 0;
      const weightB = priorityWeight[b.priority as keyof typeof priorityWeight] || 0;

      if (weightA !== weightB) return weightB - weightA;

      if (a.deadline && b.deadline) return localDateTime(a.deadline) - localDateTime(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });

  const topPriorities = allPriorities.slice(0, 3);
  const morePrioritiesCount = Math.max(0, allPriorities.length - topPriorities.length);

  // Aguardando Terceiros
  const waitingTasks = tasks.filter(t => t.status === 'aguardando_terceiro').slice(0, 4);

  // Projetos que precisam de atenção (prazo apertado ou tarefa atrasada sem estar na lista acima)
  const projectsNeedingAttention = projects
    .filter(p => p.status !== 'concluido')
    .filter(p => {
      const hasOverdueTasks = p.tasks?.some((t: any) => t.deadline && isPast(parseLocalDate(t.deadline)) && !isToday(parseLocalDate(t.deadline)) && t.status !== 'concluido');
      const deadlineSoon = p.deadline && differenceInDays(parseLocalDate(p.deadline)!, new Date()) < 7;
      return hasOverdueTasks || deadlineSoon;
    })
    .slice(0, 3);

  return (
    <AppLayout>
      <header className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight">Olá, Marcão</h2>
        <p className="text-muted-foreground capitalize">{dateStr}</p>
      </header>

      {/* Régua de números — informação, não decisão. Um clique leva pro detalhe. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-8 pb-6 border-b text-sm">
        <Link to="/projetos" className="text-muted-foreground hover:text-foreground transition-colors">
          <span className="font-bold text-foreground">{activeProjectsCount}</span> projetos ativos
        </Link>
        <span className="text-muted-foreground/40">·</span>
        <Link to="/tarefas" className="text-muted-foreground hover:text-foreground transition-colors">
          <span className="font-bold text-foreground">{pendingTasksCount}</span> pendências
        </Link>
        <span className="text-muted-foreground/40">·</span>
        <Link to="/financeiro" className="text-muted-foreground hover:text-foreground transition-colors">
          <span className="font-bold text-emerald-600">{currency(aReceber)}</span> a receber
        </Link>
        <span className="text-muted-foreground/40">·</span>
        <Link to="/financeiro" className="text-muted-foreground hover:text-foreground transition-colors">
          <span className="font-bold text-destructive">{currency(aPagar)}</span> a pagar
          {pagarVencido > 0 && (
            <span className="ml-1 font-bold text-destructive">
              ({currency(pagarVencido)} vencido)
            </span>
          )}
        </Link>
      </div>

      {/* O que fazer agora — a pergunta que o dashboard existe pra responder */}
      <section className="mb-8">
        <h3 className="text-lg font-bold tracking-tight mb-4">O que fazer agora</h3>
        {topPriorities.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
            <p className="text-sm text-muted-foreground">Nada urgente pendente. Bom trabalho.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {topPriorities.map(item => (
              <PriorityCard key={`${item.type}-${item.id}`} item={item} />
            ))}
            {morePrioritiesCount > 0 && (
              <Link
                to="/tarefas"
                className="flex items-center justify-center gap-1.5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide hover:text-primary transition-colors"
              >
                + {morePrioritiesCount} {morePrioritiesCount === 1 ? "pendência" : "pendências"} <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </section>

      {reminders.length > 0 && (
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <Bell className="h-4 w-4 text-primary" /> Lembretes
            </h3>
            <Link
              to="/lembretes"
              className="text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary"
            >
              Ver todos
            </Link>
          </div>
          <div className="space-y-2">
            {reminders.map((r) => {
              const overdue = isPast(new Date(r.remind_at)) && !isToday(new Date(r.remind_at));
              return (
                <div
                  key={r.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/30",
                    overdue && "border-destructive/30 bg-destructive/5",
                  )}
                >
                  <button
                    type="button"
                    aria-label="Concluir lembrete"
                    title="Concluir"
                    onClick={() => concluirLembrete.mutate(r.id)}
                    disabled={concluirLembrete.isPending}
                    className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  {r.project_id ? (
                    <Link
                      to="/projetos/$projectId"
                      params={{ projectId: r.project_id }}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary"
                    >
                      {r.title}
                    </Link>
                  ) : (
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{r.title}</p>
                  )}
                  <span
                    className={cn(
                      "shrink-0 text-[11px] font-bold",
                      overdue ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {overdue
                      ? format(new Date(r.remind_at), "dd/MM HH:mm")
                      : format(new Date(r.remind_at), "HH:mm")}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Financeiro — o que entra, o que sai, o que está vencendo */}
      {transactions.length > 0 && (
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold tracking-tight">Financeiro</h3>
            <Link
              to="/financeiro"
              className="text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary"
            >
              Abrir financeiro
            </Link>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-3">
            <MoneyTile label="Entrou no mês" value={currency(entrouMes)} tone="in" />
            <MoneyTile label="Saiu no mês" value={currency(saiuMes)} tone="out" />
            <MoneyTile
              label="Saldo do mês"
              value={currency(entrouMes - saiuMes)}
              tone={entrouMes - saiuMes < 0 ? "out" : "in"}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <BillList
              title="Contas a pagar"
              icon={TrendingDown}
              accent="text-destructive"
              total={aPagar}
              lateTotal={pagarVencido}
              items={contasAPagar}
            />
            <BillList
              title="A receber"
              icon={TrendingUp}
              accent="text-emerald-600"
              total={aReceber}
              items={contasAReceber}
            />
          </div>
        </section>
      )}

      {/* Sinais secundários — quem está travando você, e o que está silenciosamente atrasando */}
      <div className="grid gap-6 md:grid-cols-2">
        <MiniSection title="Aguardando resposta" icon={MessageSquare} emptyText="Ninguém te atrasando hoje.">
          {waitingTasks.map(task => (
            <AttentionItem
              key={task.id}
              name={task.waiting_for || "Terceiro"}
              reason={task.title}
              project={(task as any).projects?.name}
              days={differenceInDays(new Date(), new Date(task.updated_at || new Date()))}
            />
          ))}
        </MiniSection>

        <MiniSection title="Projetos pedindo atenção" icon={TrendingDown} emptyText="Projetos sob controle.">
          {projectsNeedingAttention.map(project => (
            <ProjectRiskItem key={project.id} project={project} />
          ))}
        </MiniSection>
      </div>

      <div className="mt-6">
        <EstudarAgora projectId="" />
      </div>
    </AppLayout>
  );
}

function MoneyTile({ label, value, tone }: { label: string; value: string; tone: "in" | "out" }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-base font-black tabular-nums sm:text-lg",
          tone === "in" ? "text-emerald-600" : "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function BillList({
  title,
  icon: Icon,
  accent,
  total,
  lateTotal,
  items,
}: {
  title: string;
  icon: any;
  accent: string;
  total: number;
  lateTotal?: number;
  items: any[];
}) {
  const shown = items.slice(0, 6);
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-bold">
          <Icon className={cn("h-4 w-4", accent)} /> {title}
        </h4>
        <span className={cn("text-sm font-black tabular-nums", accent)}>{currency(total)}</span>
      </div>
      {lateTotal !== undefined && lateTotal > 0 && (
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-destructive">
          {currency(lateTotal)} vencido
        </p>
      )}
      {shown.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Nada pendente.</p>
      ) : (
        <ul className="space-y-1.5">
          {shown.map((t) => {
            const due = parseLocalDate(t.due_date);
            const late = due && isPast(due) && !isToday(due);
            return (
              <li
                key={t.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm",
                  late && "border-destructive/30 bg-destructive/5",
                )}
              >
                <span className="min-w-0 flex-1 truncate">
                  {t.description}
                  {t.projects?.name && (
                    <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">
                      · {t.projects.name}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[11px] font-bold",
                    late ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {due ? format(due, "dd/MM") : "s/ data"}
                </span>
                <span className="shrink-0 text-xs font-black tabular-nums">{currency(t.amount)}</span>
              </li>
            );
          })}
        </ul>
      )}
      {items.length > shown.length && (
        <Link
          to="/financeiro"
          className="mt-2 block text-center text-[11px] font-bold uppercase tracking-wide text-muted-foreground hover:text-primary"
        >
          + {items.length - shown.length} lançamento(s)
        </Link>
      )}
    </div>
  );
}

function PriorityCard({ item }: { item: any }) {
  const isOverdue = item.deadline && isPast(parseLocalDate(item.deadline)) && !isToday(parseLocalDate(item.deadline));
  const content = (
    <div
      className={cn(
        "flex items-center justify-between gap-3 p-4 rounded-xl border bg-card transition-all duration-200 hover:border-primary/30 hover:shadow-sm active:scale-[0.99]",
        isOverdue && "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-bold truncate">{item.title}</p>
          <Badge variant={item.priority === 'alta' ? 'destructive' : 'secondary'} className="h-4 text-[8px] px-1.5 uppercase py-0 leading-none shrink-0">
            {item.priority}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground font-medium">{item.projects?.name || "Geral"}</p>
      </div>
      <div className={cn(
        "text-[11px] font-black px-2 py-1 rounded border shrink-0",
        isOverdue ? "bg-destructive/10 border-destructive/20 text-destructive" : "bg-background",
      )}>
        {item.deadline ? format(parseLocalDate(item.deadline)!, "dd/MM") : "S/D"}
      </div>
    </div>
  );

  if (item.projectId) {
    return (
      <Link to="/projetos/$projectId" params={{ projectId: item.projectId }} className="block">
        {content}
      </Link>
    );
  }
  return <Link to="/tarefas" className="block">{content}</Link>;
}

function MiniSection({ title, icon: Icon, emptyText, children }: any) {
  const hasContent = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center mb-4">
        <Icon className="h-4 w-4 mr-2 text-primary" />
        <h4 className="text-sm font-bold">{title}</h4>
      </div>
      <div className="space-y-2.5">
        {hasContent ? children : (
          <p className="text-xs text-muted-foreground py-3 text-center">{emptyText}</p>
        )}
      </div>
    </div>
  );
}

function AttentionItem({ name, reason, project, days }: any) {
  return (
    <div className="p-2.5 rounded-lg border border-dashed border-amber-500/20 bg-amber-500/5">
      <div className="flex justify-between items-start mb-1">
        <p className="text-xs font-black text-amber-600 dark:text-amber-400">{name}</p>
        <span className="text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded uppercase shrink-0">
          {days} {days === 1 ? 'dia' : 'dias'}
        </span>
      </div>
      <p className="text-[11px] text-foreground/80 line-clamp-1 mb-0.5">{reason}</p>
      {project && <p className="text-[9px] text-muted-foreground uppercase font-bold">{project}</p>}
    </div>
  );
}

function ProjectRiskItem({ project }: any) {
  return (
    <Link
      to="/projetos/$projectId"
      params={{ projectId: project.id }}
      className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-destructive/10 hover:border-destructive/30 transition-all"
    >
      <p className="text-xs font-bold truncate">{project.name}</p>
      <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
    </Link>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2,
  MessageSquare,
  TrendingDown,
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
      const { data } = await supabase.from('financial_transactions').select('*');
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

  const aReceber = transactions
    .filter(t => t.type === 'receita' && t.status === 'pendente')
    .reduce((acc, t) => acc + t.amount, 0);

  const aPagar = transactions
    .filter(t => t.type === 'despesa' && t.status === 'pendente')
    .reduce((acc, t) => acc + t.amount, 0);

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
          <h3 className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" /> Lembretes de hoje
          </h3>
          <div className="space-y-2">
            {reminders.map((r) => {
              const row = (
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-card transition-colors hover:border-primary/30">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <span className="shrink-0 text-[11px] font-bold text-muted-foreground">
                    {format(new Date(r.remind_at), "HH:mm")}
                  </span>
                </div>
              );
              return r.project_id ? (
                <Link
                  key={r.id}
                  to="/projetos/$projectId"
                  params={{ projectId: r.project_id }}
                  className="block"
                >
                  {row}
                </Link>
              ) : (
                <div key={r.id}>{row}</div>
              );
            })}
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

import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Briefcase, 
  CheckSquare, 
  DollarSign, 
  TrendingUp, 
  AlertCircle,
  Clock,
  MessageSquare,
  TrendingDown,
  Wallet,
  User,
  ExternalLink
} from "lucide-react";
import { format, isPast, isToday, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const { data: projects = [] } = useQuery({
    queryKey: ['dashboard-projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*, tasks(*)');
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

  const dateStr = new Date().toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Cálculos Reais
  const activeProjectsCount = projects.filter(p => p.status !== 'concluido' && p.status !== 'pausado').length;
  const pendingTasksCount = tasks.filter(t => t.status !== 'concluido').length;
  
  const totalReceitas = transactions
    .filter(t => t.type === 'receita' && t.status === 'pago')
    .reduce((acc, t) => acc + t.amount, 0);
  
  const aReceber = transactions
    .filter(t => t.type === 'receita' && t.status === 'pendente')
    .reduce((acc, t) => acc + t.amount, 0);

  const aPagar = transactions
    .filter(t => t.type === 'despesa' && t.status === 'pendente')
    .reduce((acc, t) => acc + t.amount, 0);

  // Prioridades do dia (até 5)
  const priorities = tasks
    .filter(t => t.status !== 'concluido')
    .sort((a, b) => {
      const isOverdueA = a.deadline && isPast(new Date(a.deadline)) && !isToday(new Date(a.deadline)) ? 1 : 0;
      const isOverdueB = b.deadline && isPast(new Date(b.deadline)) && !isToday(new Date(b.deadline)) ? 1 : 0;
      if (isOverdueA !== isOverdueB) return isOverdueB - isOverdueA;
      
      const priorityWeight = { alta: 3, media: 2, baixa: 1 };
      if (priorityWeight[a.priority as keyof typeof priorityWeight] !== priorityWeight[b.priority as keyof typeof priorityWeight]) {
        return priorityWeight[b.priority as keyof typeof priorityWeight] - priorityWeight[a.priority as keyof typeof priorityWeight];
      }
      
      if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    })
    .slice(0, 5);

  // Aguardando Terceiros
  const waitingTasks = tasks.filter(t => t.status === 'aguardando_terceiro');

  // Projetos que precisam de atenção
  const projectsNeedingAttention = projects
    .filter(p => p.status !== 'concluido')
    .filter(p => {
      const hasOverdueTasks = p.tasks?.some((t: any) => t.deadline && isPast(new Date(t.deadline)) && !isToday(new Date(t.deadline)) && t.status !== 'concluido');
      const deadlineSoon = p.deadline && differenceInDays(new Date(p.deadline), new Date()) < 7;
      return hasOverdueTasks || deadlineSoon;
    })
    .slice(0, 3);

  return (
    <AppLayout>
      <header className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Olá, Marcão</h2>
        <p className="text-muted-foreground capitalize">{dateStr}</p>
      </header>

      {/* Resumo Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard 
          title="Projetos Ativos" 
          value={activeProjectsCount.toString()} 
          icon={Briefcase} 
          trend="Em andamento"
        />
        <StatCard 
          title="Pendências" 
          value={pendingTasksCount.toString()} 
          icon={CheckSquare} 
          trend={`${tasks.filter(t => t.priority === 'alta' && t.status !== 'concluido').length} críticas`}
          status={tasks.some(t => t.priority === 'alta' && t.status !== 'concluido') ? "warning" : undefined}
        />
        <StatCard 
          title="A Receber" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(aReceber)} 
          icon={TrendingUp} 
          trend="Previsto"
          status="success"
        />
        <StatCard 
          title="A Pagar" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(aPagar)} 
          icon={DollarSign} 
          trend="Pendente"
          status="destructive"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Prioridades do Dia */}
        <DashboardSection title="Prioridades do Dia" icon={AlertCircle}>
          <div className="space-y-3">
            {priorities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma prioridade urgente.</p>
            ) : priorities.map(task => (
              <PriorityItem 
                key={task.id}
                title={task.title} 
                time={task.deadline ? format(new Date(task.deadline), "dd/MM") : "S/D"} 
                project={task.projects?.name || "Geral"} 
                priority={task.priority}
              />
            ))}
          </div>
        </DashboardSection>

        {/* Aguardando Terceiros */}
        <DashboardSection title="Aguardando Terceiros" icon={MessageSquare}>
          <div className="space-y-3">
            {waitingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Ninguém te atrasando hoje.</p>
            ) : waitingTasks.map(task => (
              <AttentionItem 
                key={task.id}
                name={task.waiting_for || "Terceiro"} 
                reason={task.title} 
                project={task.projects?.name}
                days={differenceInDays(new Date(), new Date(task.updated_at || new Date()))}
              />
            ))}
          </div>
        </DashboardSection>

        {/* Projetos que precisam de atenção */}
        <DashboardSection title="Projetos em Risco" icon={TrendingDown}>
          <div className="space-y-3">
            {projectsNeedingAttention.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Projetos sob controle.</p>
            ) : projectsNeedingAttention.map(project => (
              <ProjectRiskItem 
                key={project.id}
                project={project}
              />
            ))}
          </div>
        </DashboardSection>
      </div>
    </AppLayout>
  );
}

function StatCard({ title, value, icon: Icon, trend, status }: any) {
  const statusColors: any = {
    warning: "text-amber-500",
    success: "text-emerald-500",
    destructive: "text-destructive",
  };

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-2xl font-bold">{value}</h3>
        <p className={cn("text-xs mt-1", status && statusColors[status])}>{trend}</p>
      </div>
    </div>
  );
}

function DashboardSection({ title, icon: Icon, children }: any) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center mb-6">
        <Icon className="h-5 w-5 mr-2 text-primary" />
        <h4 className="font-semibold">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function PriorityItem({ title, time, project, priority }: any) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-accent/30 border border-transparent hover:border-primary/20 transition-all cursor-pointer group">
      <div className="flex-1 min-w-0 mr-3">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{title}</p>
          <Badge variant={priority === 'alta' ? 'destructive' : 'secondary'} className="h-3 text-[8px] px-1 uppercase py-0 leading-none">
            {priority}
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">{project}</p>
      </div>
      <div className="text-[10px] font-black bg-background px-2 py-1 rounded border shadow-sm shrink-0">
        {time}
      </div>
    </div>
  );
}

function AttentionItem({ name, reason, project, days }: any) {
  return (
    <div className="p-3 rounded-lg border border-dashed border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40 transition-all">
      <div className="flex justify-between items-start mb-1">
        <p className="text-sm font-black text-amber-900">{name}</p>
        <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded uppercase">
          {days} {days === 1 ? 'dia' : 'dias'}
        </span>
      </div>
      <p className="text-xs text-amber-800 line-clamp-1 mb-1">{reason}</p>
      <p className="text-[9px] text-muted-foreground uppercase font-bold">{project}</p>
    </div>
  );
}

function ProjectRiskItem({ project }: any) {
  const totalTasks = project.tasks?.length || 0;
  const completedTasks = project.tasks?.filter((t: any) => t.status === 'concluido').length || 0;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <Link 
      to="/projetos/$projectId" 
      params={{ projectId: project.id }}
      className="block p-3 rounded-lg border border-destructive/10 bg-card hover:border-destructive/30 transition-all"
    >
      <div className="flex justify-between items-start mb-2">
        <p className="text-sm font-bold truncate">{project.name}</p>
        <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
      </div>
      <Progress value={progress} className="h-1 mb-2" />
      <div className="flex justify-between items-center text-[10px] text-muted-foreground font-bold uppercase">
        <span>{Math.round(progress)}% Concluído</span>
        <span className="text-destructive">Atenção Necessária</span>
      </div>
    </Link>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

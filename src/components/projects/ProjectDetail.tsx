import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Target, 
  ChevronLeft,
  ArrowRight,
  MoreVertical,
  Briefcase,
  TrendingDown,
  TrendingUp,
  Wallet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function ProjectDetail() {
  const { projectId } = useParams({ from: '/projetos/$projectId' });

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          tasks (*),
          financial_transactions (*)
        `)
        .eq('id', projectId)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  if (!project) return <div>Projeto não encontrado.</div>;

  const completedTasks = project.tasks?.filter((t: any) => t.status === 'concluido').length || 0;
  const totalTasks = project.tasks?.length || 0;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Lógica Financeira Real
  const receitas = project.financial_transactions
    ?.filter((t: any) => t.type === 'receita')
    .reduce((acc: number, t: any) => acc + t.amount, 0) || 0;
  
  const despesas = project.financial_transactions
    ?.filter((t: any) => t.type === 'despesa')
    .reduce((acc: number, t: any) => acc + t.amount, 0) || 0;

  const resultadoFinanceiro = receitas - despesas;

  // Gerar timeline a partir das tarefas ordenadas por data
  const timelineEvents = project.tasks
    ? [...project.tasks]
        .filter((t: any) => t.deadline)
        .sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    : [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link to="/projetos">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="capitalize">
                {project.category || "Sem categoria"}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {project.status?.replace(/_/g, ' ')}
              </Badge>
            </div>
            <h2 className="text-3xl font-bold tracking-tight">{project.name}</h2>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon"><MoreVertical className="h-4 w-4" /></Button>
          <Button>Editar Projeto</Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Progresso</span>
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold">{Math.round(progress)}%</div>
          <Progress value={progress} className="h-2 mt-4" />
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground text-emerald-700">Receitas</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receitas)}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Total recebido</p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground text-destructive">Despesas</span>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </div>
          <div className="text-2xl font-black text-destructive">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(despesas)}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Custo real total</p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Deadline</span>
            <Calendar className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold">
            {project.deadline ? format(new Date(project.deadline), "dd MMM", { locale: ptBR }) : "Indefinido"}
          </div>
          <p className="text-xs text-muted-foreground mt-2">{project.deadline ? format(new Date(project.deadline), "yyyy") : "Sem data alvo"}</p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground text-primary">Resultado</span>
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <div className={cn("text-2xl font-black", resultadoFinanceiro < 0 ? "text-destructive" : "text-primary")}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resultadoFinanceiro)}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Margem atual</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Timeline Executiva */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Timeline Executiva
            </h3>
            <Button variant="ghost" size="sm">Ver tudo</Button>
          </div>

          <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
            {timelineEvents.length === 0 ? (
              <div className="pl-12 py-4 text-muted-foreground italic">Nenhum evento com prazo definido.</div>
            ) : timelineEvents.map((event: any, index: number) => (
              <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                {/* Dot */}
                <div className="flex items-center justify-center w-10 h-10 rounded-full border bg-background shadow-sm z-10 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 transition-colors group-hover:border-primary">
                  {event.status === 'concluido' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <div className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      event.priority === 'alta' ? "bg-destructive animate-pulse" : "bg-primary"
                    )} />
                  )}
                </div>
                {/* Content */}
                <div className="w-[calc(100%-4rem)] md:w-[45%] p-4 rounded-xl border bg-card shadow-sm hover:border-primary/50 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <time className="font-mono text-xs font-bold text-primary">
                      {format(new Date(event.deadline), "dd/MM/yyyy")}
                    </time>
                    <Badge variant="secondary" className="text-[10px] py-0">{event.priority}</Badge>
                  </div>
                  <div className="font-bold text-foreground mb-1">{event.title}</div>
                  <div className="text-sm text-muted-foreground line-clamp-2">{event.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Detalhes */}
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h3 className="font-bold mb-4">Próxima Ação</h3>
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 text-primary font-medium flex items-center justify-between group cursor-pointer hover:bg-primary/10 transition-colors">
              {project.next_action || "Nenhuma ação definida"}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h3 className="font-bold mb-4">Notas & Estratégia</h3>
            <div className="text-sm text-muted-foreground space-y-4 whitespace-pre-line">
              {project.notes || "Sem notas estratégicas definidas para este projeto."}
            </div>
            <Button variant="link" className="px-0 mt-4 h-auto text-xs">Editar Estratégia</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  Briefcase, 
  CheckSquare, 
  DollarSign, 
  TrendingUp, 
  AlertCircle,
  Clock,
  MessageSquare
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const date = new Date().toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <AppLayout>
      <header className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Olá, Marcão</h2>
        <p className="text-muted-foreground capitalize">{date}</p>
      </header>

      {/* Resumo Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard 
          title="Projetos Ativos" 
          value="12" 
          icon={Briefcase} 
          trend="+2 este mês"
        />
        <StatCard 
          title="Tarefas Pendentes" 
          value="24" 
          icon={CheckSquare} 
          trend="5 críticas"
          status="warning"
        />
        <StatCard 
          title="A Receber" 
          value="R$ 45.200" 
          icon={TrendingUp} 
          trend="+R$ 12k previstos"
          status="success"
        />
        <StatCard 
          title="A Pagar" 
          value="R$ 12.800" 
          icon={DollarSign} 
          trend="R$ 3k vencendo"
          status="destructive"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Prioridades do Dia */}
        <DashboardSection title="Prioridades do Dia" icon={AlertCircle}>
          <div className="space-y-3">
            <PriorityItem title="Reunião com Investidor" time="14:00" project="Residencial Alpha" />
            <PriorityItem title="Revisar contrato Terreno Sul" time="16:30" project="Expansão Imobiliária" />
            <PriorityItem title="Call com Arquiteto" time="10:00" project="Reforma Loft" />
          </div>
        </DashboardSection>

        {/* Pendências de Hoje */}
        <DashboardSection title="Pendências" icon={CheckSquare}>
          <div className="space-y-3">
            <TodoItem title="Enviar proposta para Cliente X" status="atrasada" />
            <TodoItem title="Ligar para corretor" status="hoje" />
            <TodoItem title="Atualizar planilha financeira" status="hoje" />
          </div>
        </DashboardSection>

        {/* Lembretes e Retorno */}
        <DashboardSection title="Atenção" icon={MessageSquare}>
          <div className="space-y-3">
            <AttentionItem name="João Silva" reason="Aguardando retorno proposta" />
            <AttentionItem name="Maria Oliveira" reason="Dúvida sobre terreno" />
            <AttentionItem name="Projeto Beta" reason="Prazo de licença expirando" status="warning" />
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

function PriorityItem({ title, time, project }: any) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50 border border-transparent hover:border-accent transition-all cursor-pointer">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{project}</p>
      </div>
      <div className="text-xs font-semibold bg-background px-2 py-1 rounded border">
        {time}
      </div>
    </div>
  );
}

function TodoItem({ title, status }: any) {
  return (
    <div className="flex items-center p-2">
      <div className={cn(
        "h-2 w-2 rounded-full mr-3",
        status === 'atrasada' ? "bg-destructive" : "bg-primary"
      )} />
      <p className="text-sm">{title}</p>
      {status === 'atrasada' && <span className="ml-auto text-[10px] font-bold text-destructive uppercase">Atrasado</span>}
    </div>
  );
}

function AttentionItem({ name, reason, status }: any) {
  return (
    <div className="p-3 rounded-lg border border-dashed border-muted-foreground/20">
      <p className="text-sm font-semibold">{name}</p>
      <p className="text-xs text-muted-foreground">{reason}</p>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

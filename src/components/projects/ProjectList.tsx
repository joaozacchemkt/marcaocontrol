import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Filter, 
  Search,
  Plus,
  Briefcase,
  Clock,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "@tanstack/react-router";

type Project = {
  id: string;
  name: string;
  category: string | null;
  status: 'ideia' | 'em_analise' | 'planejamento' | 'em_andamento' | 'pausado' | 'concluido';
  budget: number | null;
  deadline: string | null;
  next_action: string | null;
  open_tasks_count?: number;
};

export function ProjectList() {
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState("");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          tasks(count)
        `);
      
      if (error) throw error;
      
      // Mapear contagem de tarefas abertas (simplificado para o MVP)
      return data.map((p: any) => ({
        ...p,
        open_tasks_count: p.tasks ? p.tasks.length : 0 // Idealmente seria um subselect de count
      })) as Project[];
    }
  });

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(search.toLowerCase());
    if (filter === 'todos') return matchesSearch;
    return matchesSearch && project.status === filter;
  });

  const statusIcons: any = {
    ideia: LightbulbIcon,
    em_analise: Search,
    planejamento: Clock,
    em_andamento: TrendingUp,
    pausado: PauseCircle,
    concluido: CheckCircle2,
  };

  const statusColors: any = {
    ideia: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    em_analise: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    planejamento: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    em_andamento: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    pausado: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    concluido: "bg-emerald-500 text-white border-transparent",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Projetos</h2>
          <p className="text-muted-foreground">Acompanhe seus empreendimentos e metas.</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> Novo Projeto
        </Button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar projetos..." 
            className="pl-9" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterButton active={filter === 'todos'} onClick={() => setFilter('todos')}>Todos</FilterButton>
          <FilterButton active={filter === 'ideia'} onClick={() => setFilter('ideia')}>Ideia</FilterButton>
          <FilterButton active={filter === 'em_analise'} onClick={() => setFilter('em_analise')}>Em Análise</FilterButton>
          <FilterButton active={filter === 'planejamento'} onClick={() => setFilter('planejamento')}>Planejamento</FilterButton>
          <FilterButton active={filter === 'em_andamento'} onClick={() => setFilter('em_andamento')}>Em Andamento</FilterButton>
          <FilterButton active={filter === 'pausado'} onClick={() => setFilter('pausado')}>Pausado</FilterButton>
          <FilterButton active={filter === 'concluido'} onClick={() => setFilter('concluido')}>Concluído</FilterButton>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="h-48 w-full animate-pulse rounded-xl bg-accent" />)}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-xl">
              Nenhum projeto encontrado.
            </div>
          ) : filteredProjects.map(project => {
            const StatusIcon = statusIcons[project.status] || Briefcase;
            return (
              <Link 
                key={project.id} 
                to={`/projetos/${project.id}`}
                className="group block rounded-xl border bg-card p-6 shadow-sm hover:shadow-md hover:border-primary/50 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <Badge variant="outline" className={cn("mb-2 capitalize", statusColors[project.status])}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {project.status.replace(/_/g, ' ')}
                    </Badge>
                    <h3 className="text-lg font-bold group-hover:text-primary transition-colors leading-tight">
                      {project.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">{project.category || "Sem categoria"}</p>
                  </div>
                </div>

                <div className="space-y-3 mt-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Próxima ação:</span>
                    <span className="font-medium truncate max-w-[150px]">{project.next_action || "Definir"}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dashed">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Prazo</p>
                      <p className="text-sm font-semibold">
                        {project.deadline ? format(new Date(project.deadline), "dd/MM/yyyy") : "Sem prazo"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Valor</p>
                      <p className="text-sm font-semibold text-emerald-600">
                        {project.budget ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.budget) : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <div className="flex items-center text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 mr-1 text-primary" />
                    {project.open_tasks_count} pendências abertas
                  </div>
                  <div className="h-1.5 w-24 bg-accent rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '30%' }} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterButton({ children, active, onClick }: any) {
  return (
    <Button 
      variant={active ? 'default' : 'outline'} 
      size="sm" 
      onClick={onClick}
      className="h-8 text-xs px-3"
    >
      {children}
    </Button>
  );
}

function LightbulbIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  );
}

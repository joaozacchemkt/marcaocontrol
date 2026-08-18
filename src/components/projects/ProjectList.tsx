import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  TrendingUp,
  Pencil,
  Trash2
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "@tanstack/react-router";
import { ProjectModal } from "../modals/ProjectModal";

type Project = {
  id: string;
  name: string;
  category: string | null;
  status: 'ideia' | 'em_analise' | 'planejamento' | 'em_andamento' | 'pausado' | 'concluido';
  budget: number | null;
  deadline: string | null;
  next_action: string | null;
  description?: string | null;
  objective?: string | null;
  notes?: string | null;
  start_date?: string | null;
  open_tasks_count?: number;
  total_tasks_count?: number;
  progress?: number;
};

export function ProjectList() {
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState("");
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const queryClient = useQueryClient();

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success("Projeto excluído.");
    },
    onError: (error: Error) => toast.error("Erro ao excluir projeto: " + error.message),
  });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          tasks(id, status)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map((p: any) => {
        const tasks: any[] = Array.isArray(p.tasks) ? p.tasks : [];
        const total = tasks.length;
        const done = tasks.filter(t => t.status === 'concluido').length;
        return {
          ...p,
          open_tasks_count: total - done,
          total_tasks_count: total,
          progress: total > 0 ? Math.round((done / total) * 100) : 0,
        };
      }) as Project[];
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
    pausado: "bg-muted text-muted-foreground border-border",
    concluido: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Projetos</h2>
          <p className="text-muted-foreground">Acompanhe seus empreendimentos e metas.</p>
        </div>
        <Button onClick={() => setShowProjectModal(true)}>
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
              <div key={project.id} className="relative">
                <div className="absolute right-3 top-3 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 bg-background/80"
                    aria-label="Editar projeto"
                    onClick={() => setEditingProject(project)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 text-destructive" aria-label="Excluir projeto">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
                        <AlertDialogDescription>
                          "{project.name}" e seus vínculos serão removidos permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteProject.mutate(project.id)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              <Link
                to="/projetos/$projectId"
                params={{ projectId: project.id }}
                className="group/card group block rounded-xl border bg-card p-6 shadow-sm hover:shadow-md hover:border-primary/50 transition-all"
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
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{project.progress ?? 0}%</span>
                    <div className="h-1.5 w-24 bg-accent rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${project.progress ?? 0}%` }} />
                    </div>
                  </div>
                </div>
              </Link>
              </div>
            );
          })}
        </div>
      )}
      <ProjectModal open={showProjectModal} onOpenChange={setShowProjectModal} />
      <ProjectModal
        open={editingProject !== null}
        onOpenChange={(open) => !open && setEditingProject(null)}
        project={editingProject}
      />
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

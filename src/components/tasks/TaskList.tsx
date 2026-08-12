import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  List, 
  LayoutGrid, 
  Filter, 
  Search,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, isPast, isToday, isThisWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

// Tipagem baseada no banco
type Task = {
  id: string;
  title: string;
  description: string | null;
  status: 'a_fazer' | 'em_andamento' | 'aguardando_terceiro' | 'concluido';
  priority: 'baixa' | 'media' | 'alta';
  deadline: string | null;
  responsible: string | null;
  project_id: string | null;
  projects?: { name: string } | null;
};

export function TaskList() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [filter, setFilter] = useState('todas');
  const [search, setSearch] = useState("");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, projects(name)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as Task[];
    }
  });

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(search.toLowerCase());
    
    if (filter === 'atrasadas') {
      return matchesSearch && task.deadline && isPast(new Date(task.deadline)) && !isToday(new Date(task.deadline)) && task.status !== 'concluido';
    }
    if (filter === 'hoje') {
      return matchesSearch && task.deadline && isToday(new Date(task.deadline));
    }
    if (filter === 'esta_semana') {
      return matchesSearch && task.deadline && isThisWeek(new Date(task.deadline));
    }
    if (filter === 'alta_prioridade') {
      return matchesSearch && task.priority === 'alta';
    }
    if (filter === 'aguardando_terceiros') {
      return matchesSearch && task.status === 'aguardando_terceiro';
    }
    if (filter === 'concluidas') {
      return matchesSearch && task.status === 'concluido';
    }
    
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pendências</h2>
          <p className="text-muted-foreground">Gerencie suas tarefas e prazos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v: any) => setView(v)} className="w-auto">
            <TabsList>
              <TabsTrigger value="list"><List className="h-4 w-4 mr-2" /> Lista</TabsTrigger>
              <TabsTrigger value="kanban"><LayoutGrid className="h-4 w-4 mr-2" /> Kanban</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button>
            <Plus className="h-4 w-4 mr-2" /> Novo
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar tarefas..." 
            className="pl-9" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterButton active={filter === 'todas'} onClick={() => setFilter('todas')}>Todas</FilterButton>
          <FilterButton active={filter === 'hoje'} onClick={() => setFilter('hoje')}>Hoje</FilterButton>
          <FilterButton active={filter === 'atrasadas'} onClick={() => setFilter('atrasadas')} variant="destructive">Atrasadas</FilterButton>
          <FilterButton active={filter === 'esta_semana'} onClick={() => setFilter('esta_semana')}>Esta semana</FilterButton>
          <FilterButton active={filter === 'alta_prioridade'} onClick={() => setFilter('alta_prioridade')}>Alta prioridade</FilterButton>
          <FilterButton active={filter === 'aguardando_terceiros'} onClick={() => setFilter('aguardando_terceiros')}>Aguardando</FilterButton>
          <FilterButton active={filter === 'concluidas'} onClick={() => setFilter('concluidas')}>Concluídas</FilterButton>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-20 w-full animate-pulse rounded-lg bg-accent" />)}
        </div>
      ) : view === 'list' ? (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-accent/50 border-b">
              <tr>
                <th className="text-left p-4 font-medium text-muted-foreground">Título</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Projeto</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Responsável</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Prazo</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Prioridade</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhuma tarefa encontrada.</td>
                </tr>
              ) : filteredTasks.map(task => (
                <tr key={task.id} className="hover:bg-accent/30 transition-colors cursor-pointer group">
                  <td className="p-4">
                    <div className="flex items-center">
                      <div className={cn(
                        "h-2 w-2 rounded-full mr-3",
                        task.status === 'concluido' ? "bg-emerald-500" : "bg-primary"
                      )} />
                      <span className={cn("font-medium", task.status === 'concluido' && "line-through text-muted-foreground")}>
                        {task.title}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-muted-foreground">{task.projects?.name || "-"}</td>
                  <td className="p-4">{task.responsible || "-"}</td>
                  <td className="p-4">
                    {task.deadline ? (
                      <span className={cn(
                        isPast(new Date(task.deadline)) && !isToday(new Date(task.deadline)) && task.status !== 'concluido' && "text-destructive font-semibold"
                      )}>
                        {format(new Date(task.deadline), "dd 'de' MMM", { locale: ptBR })}
                      </span>
                    ) : "-"}
                  </td>
                  <td className="p-4 text-center">
                    <Badge variant={
                      task.priority === 'alta' ? "destructive" : 
                      task.priority === 'media' ? "default" : "secondary"
                    } className="capitalize px-2 py-0">
                      {task.priority}
                    </Badge>
                  </td>
                  <td className="p-4">
                     <Badge variant="outline" className="capitalize">
                      {task.status.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <TaskKanban tasks={filteredTasks} />
      )}
    </div>
  );
}

function FilterButton({ children, active, onClick, variant = 'default' }: any) {
  return (
    <Button 
      variant={active ? (variant === 'destructive' ? 'destructive' : 'default') : 'outline'} 
      size="sm" 
      onClick={onClick}
      className="h-8 text-xs px-3"
    >
      {children}
    </Button>
  );
}

// Kanban Component (Simplificado para o MVP do plano)
function TaskKanban({ tasks }: { tasks: Task[] }) {
  const columns = [
    { id: 'a_fazer', label: 'A fazer' },
    { id: 'em_andamento', label: 'Em andamento' },
    { id: 'aguardando_terceiro', label: 'Aguardando terceiro' },
    { id: 'concluido', label: 'Concluído' },
  ];

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
      {columns.map(col => (
        <div key={col.id} className="flex-1 min-w-[280px] flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-semibold text-sm flex items-center">
              {col.label}
              <Badge variant="secondary" className="ml-2 h-5 min-w-5 flex items-center justify-center p-0 rounded-full">
                {tasks.filter(t => t.status === col.id).length}
              </Badge>
            </h3>
          </div>
          <div className="flex-1 rounded-xl bg-accent/30 p-2 space-y-3">
            {tasks.filter(t => t.status === col.id).map(task => (
              <div key={task.id} className="bg-card p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer space-y-3 group">
                <div className="space-y-1">
                  <div className="flex items-start justify-between">
                    <h4 className="font-medium text-sm leading-tight group-hover:text-primary transition-colors">
                      {task.title}
                    </h4>
                  </div>
                  {task.projects?.name && (
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                      {task.projects.name}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center justify-between pt-2">
                   <div className="flex -space-x-2">
                    <div className="h-6 w-6 rounded-full bg-accent border-2 border-card flex items-center justify-center text-[10px] font-bold">
                      {task.responsible?.charAt(0) || "U"}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {task.deadline && (
                       <span className={cn(
                        "text-[10px] font-medium",
                        isPast(new Date(task.deadline)) && !isToday(new Date(task.deadline)) && task.status !== 'concluido' ? "text-destructive" : "text-muted-foreground"
                      )}>
                        {format(new Date(task.deadline), "dd/MM")}
                      </span>
                    )}
                    <Badge variant={
                      task.priority === 'alta' ? "destructive" : 
                      task.priority === 'media' ? "default" : "secondary"
                    } className="h-4 text-[9px] px-1.5 uppercase font-bold tracking-tighter">
                      {task.priority}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

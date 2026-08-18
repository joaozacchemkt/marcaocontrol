import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  List, 
  LayoutGrid, 
  Filter, 
  Search,
  Plus,
  Clock,
  User,
  AlertCircle,
  X,
  Check,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, isPast, isToday, isThisWeek, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DatePickerWithRange } from "../ui/date-range-picker";
import { DateRange } from "react-day-picker";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { TaskModal } from "../modals/TaskModal";
import { logActivity } from "@/lib/activity";
import { advanceRecurrence } from "@/lib/recurrence";

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
  waiting_for: string | null;
  projects?: { name: string } | null;
};

const COLUMNS = [
  { id: 'a_fazer', label: 'A fazer' },
  { id: 'em_andamento', label: 'Em andamento' },
  { id: 'aguardando_terceiro', label: 'Aguardando terceiro' },
  { id: 'concluido', label: 'Concluído' },
] as const;

export function TaskList({ initialProjectId }: { initialProjectId?: string }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'list' | 'kanban'>('kanban');
  const [filter, setFilter] = useState('todas');
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', initialProjectId],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('*, projects(name)')
        .order('created_at', { ascending: false });
      
      if (initialProjectId) {
        query = query.eq('project_id', initialProjectId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as unknown as Task[];
    }
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string, status: Task['status'] }) => {
      const { data: task, error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;

      // Tarefa recorrente concluída => gera a próxima ocorrência.
      const recurrenceId = (task as { recurrence_id?: string | null } | null)
        ?.recurrence_id;
      if (status === 'concluido' && recurrenceId) {
        await advanceRecurrence(recurrenceId);
      }

      if (task && task.project_id) {
        const statusLabels: Record<string, string> = {
          'a_fazer': 'A fazer',
          'em_andamento': 'Em andamento',
          'aguardando_terceiro': 'Aguardando terceiro',
          'concluido': 'Concluído'
        };

        await logActivity({
          projectId: task.project_id,
          type: status === 'concluido' ? 'task_completed' : 'task_reopened',
          description: `Tarefa "${task.title}" movida para ${statusLabels[status]}`,
          entityType: 'task',
          entityId: task.id
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      toast.error("Erro ao atualizar status: " + error.message);
    }
  });

  /** Exclusão definitiva de uma pendência (sem campo soft-delete na tabela). */
  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pendência excluída.");
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: Error) => toast.error("Erro ao excluir: " + error.message),
  });

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(search.toLowerCase());
    
    // Filtro de Data Personalizado
    if (dateRange?.from) {
      if (!task.deadline) return false;
      const taskDate = new Date(task.deadline);
      const start = startOfDay(dateRange.from);
      const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      if (!isWithinInterval(taskDate, { start, end })) return false;
    }

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
          <p className="text-muted-foreground">Gerencie suas tarefas e prazos estratégicos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v: any) => setView(v)} className="w-auto">
            <TabsList>
              <TabsTrigger value="list"><List className="h-4 w-4 mr-2" /> Lista</TabsTrigger>
              <TabsTrigger value="kanban"><LayoutGrid className="h-4 w-4 mr-2" /> Kanban</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => setShowTaskModal(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar tarefas..." 
            className="pl-9 bg-card" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <DatePickerWithRange date={dateRange} setDate={setDateRange} />
          {dateRange && (
            <Button variant="ghost" size="icon" onClick={() => setDateRange(undefined)} className="h-9 w-9">
              <X className="h-4 w-4" />
            </Button>
          )}
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
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-accent/50 border-b">
              <tr>
                <th className="text-left p-4 font-medium text-muted-foreground">Título</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Projeto</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Responsável</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Prazo</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Prioridade</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                <th className="text-right p-4 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhuma tarefa encontrada.</td>
                </tr>
              ) : filteredTasks.map(task => (
                <tr
                  key={task.id}
                  className="hover:bg-accent/30 transition-colors cursor-pointer group"
                  onClick={() => setEditingTask(task)}
                  title="Clique para editar"
                >
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
        <TaskKanban 
          tasks={filteredTasks} 
          onStatusChange={(taskId, status) => updateTaskStatus.mutate({ taskId, status })}
        />
      )}

      <TaskModal
        open={editingTask !== null}
        onOpenChange={(open) => !open && setEditingTask(null)}
        task={editingTask}
      />
      <TaskModal 
        open={showTaskModal} 
        onOpenChange={setShowTaskModal}
      />
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

interface KanbanProps {
  tasks: Task[];
  onStatusChange: (taskId: string, status: Task['status']) => void;
}

function TaskKanban({ tasks, onStatusChange }: KanbanProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Se soltou sobre uma coluna ou um card em outra coluna
    const newStatus = COLUMNS.find(col => col.id === overId)?.id || 
                     tasks.find(t => t.id === overId)?.status;

    if (newStatus && newStatus !== tasks.find(t => t.id === taskId)?.status) {
      onStatusChange(taskId, newStatus as Task['status']);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6 overflow-x-auto pb-6 min-h-[600px] items-start">
        {COLUMNS.map(col => (
          <KanbanColumn 
            key={col.id} 
            id={col.id} 
            label={col.label} 
            tasks={tasks.filter(t => t.status === col.id)}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{
        sideEffects: defaultDropAnimationSideEffects({
          styles: {
            active: {
              opacity: '0.5',
            },
          },
        }),
      }}>
        {activeTask ? <KanbanCard task={activeTask} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({ id, label, tasks }: { id: string, label: string, tasks: Task[] }) {
  return (
    <div className="flex-1 min-w-[300px] flex flex-col gap-4 bg-accent/20 rounded-2xl p-4 border border-border/50">
      <div className="flex items-center justify-between px-2">
        <h3 className="font-bold text-sm flex items-center gap-2">
          {label}
          <Badge variant="secondary" className="h-5 min-w-5 flex items-center justify-center p-0 rounded-full bg-background/50 border-none text-[10px]">
            {tasks.length}
          </Badge>
        </h3>
      </div>
      
      <SortableContext 
        id={id}
        items={tasks.map(t => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 flex flex-col gap-3 min-h-[150px]">
          {tasks.map(task => (
            <KanbanCard key={task.id} task={task} />
          ))}
          {tasks.length === 0 && (
            <div className="h-24 rounded-xl border border-dashed border-muted-foreground/20 flex items-center justify-center text-xs text-muted-foreground">
              Solte tarefas aqui
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function KanbanCard({ task, isOverlay = false }: { task: Task, isOverlay?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const isOverdue = task.deadline && isPast(new Date(task.deadline)) && !isToday(new Date(task.deadline)) && task.status !== 'concluido';

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={cn(
        "bg-card p-4 rounded-xl border shadow-sm transition-all cursor-grab active:cursor-grabbing group select-none",
        isOverlay && "shadow-xl border-primary ring-2 ring-primary/20 cursor-grabbing",
        !isOverlay && "hover:border-primary/50 hover:shadow-md",
        isOverdue && "border-destructive/30 bg-destructive/5"
      )}
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h4 className={cn(
              "font-bold text-sm leading-snug group-hover:text-primary transition-colors",
              task.status === 'concluido' && "text-muted-foreground line-through font-medium"
            )}>
              {task.title}
            </h4>
            {isOverdue && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
          </div>
          
          {task.projects?.name && (
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 py-0 font-bold uppercase tracking-wider bg-accent/30 border-none text-muted-foreground">
                {task.projects.name}
              </Badge>
            </div>
          )}
        </div>

        {task.status === 'aguardando_terceiro' && task.waiting_for && (
          <div className="py-1.5 px-2 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
            <User className="h-3 w-3 text-amber-600" />
            <span className="text-[10px] font-bold text-amber-700">Aguardando: {task.waiting_for}</span>
          </div>
        )}
        
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
              {task.responsible?.charAt(0) || <User className="h-3 w-3" />}
            </div>
            {task.responsible && (
              <span className="text-[10px] font-medium text-muted-foreground">{task.responsible}</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {task.deadline && (
               <div className={cn(
                "flex items-center gap-1 text-[10px] font-bold",
                isOverdue ? "text-destructive" : "text-muted-foreground"
              )}>
                <Clock className="h-3 w-3" />
                {format(new Date(task.deadline), "dd/MM")}
              </div>
            )}
            <Badge variant={
              task.priority === 'alta' ? "destructive" : 
              task.priority === 'media' ? "default" : "secondary"
            } className="h-4 text-[8px] px-1.5 uppercase font-black border-none">
              {task.priority}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

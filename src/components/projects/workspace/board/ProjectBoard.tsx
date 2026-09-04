import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { endOfWeek, isToday, startOfWeek } from "date-fns";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity";
import { parseLocalDate } from "@/lib/dates";
import { BoardCard } from "./BoardCard";
import { BoardColumn } from "./BoardColumn";
import { TaskDetailSheet } from "./TaskDetailSheet";
import {
  BOARD_COLUMNS,
  BOARD_FILTERS,
  STATUS_LABELS,
  isOverdue,
  type BoardFilter,
  type BoardStatus,
  type BoardTask,
} from "./board-types";

export interface ProjectBoardProps {
  projectId: string;
}

export function ProjectBoard({ projectId }: ProjectBoardProps) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<BoardFilter>("todas");
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const [selected, setSelected] = useState<BoardTask | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const queryKey = ["board-tasks", projectId];

  const { data: allTasks = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as BoardTask[];
    },
  });

  const { data: reminderIds = [] } = useQuery({
    queryKey: ["board-reminders", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("reminders")
        .select("entity_id")
        .eq("project_id", projectId)
        .eq("status", "pendente");
      return (data ?? []).map((row) => row.entity_id as string);
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BoardStatus }) => {
      const { data, error } = await supabase
        .from("tasks")
        .update({ status: status as never })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      if (data) {
        await logActivity({
          projectId,
          type: status === "concluido" ? "task_completed" : "task_reopened",
          description: `Card "${data.title}" movido para ${STATUS_LABELS[status]}`,
          entityType: "task",
          entityId: data.id,
        });
      }
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<BoardTask[]>(queryKey);
      queryClient.setQueryData<BoardTask[]>(queryKey, (old) =>
        (old ?? []).map((task) => (task.id === id ? { ...task, status } : task)),
      );
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error(error.message);
    },
    onSettled: invalidate,
  });

  const createTask = useMutation({
    mutationFn: async ({ title, status }: { title: string; status: BoardStatus }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");
      const { error } = await supabase.from("tasks").insert({
        user_id: user.id,
        project_id: projectId,
        title,
        status: status as never,
        priority: "media",
      } as never);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  /** Exclusão de cards: individual (X) ou em massa (seleção). */
  const deleteTasks = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase.from("tasks").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_data, ids) => {
      setSelectedIds(new Set());
      toast.success(ids.length > 1 ? `${ids.length} cards excluídos` : "Card excluído");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleSelect = (task: BoardTask) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(task.id)) next.delete(task.id);
      else next.add(task.id);
      return next;
    });

  const parents = useMemo(() => allTasks.filter((t) => !t.parent_task_id), [allTasks]);

  const subtaskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of allTasks) {
      if (task.parent_task_id) {
        counts[task.parent_task_id] = (counts[task.parent_task_id] ?? 0) + 1;
      }
    }
    return counts;
  }, [allTasks]);

  const reminders = useMemo(() => new Set(reminderIds), [reminderIds]);

  const visible = useMemo(() => {
    const now = new Date();
    return parents.filter((task) => {
      const deadline = parseLocalDate(task.deadline);
      switch (filter) {
        case "hoje":
          return deadline ? isToday(deadline) : false;
        case "atrasadas":
          return isOverdue(task);
        case "semana":
          return deadline
            ? deadline >= startOfWeek(now, { weekStartsOn: 1 }) &&
                deadline <= endOfWeek(now, { weekStartsOn: 1 })
            : false;
        case "alta":
          return task.priority === "alta";
        case "nao_esquecer":
          return task.status === "nao_esquecer";
        case "aguardando":
          return task.status === "aguardando_terceiro";
        case "concluidas":
          return task.status === "concluido";
        default:
          return true;
      }
    });
  }, [parents, filter]);

  const overdueCount = useMemo(() => parents.filter(isOverdue).length, [parents]);

  /** Produção do dia: tudo que foi concluído hoje (inclui subtarefas). */
  const doneToday = useMemo(
    () =>
      allTasks.filter((task) => {
        if (task.status !== "concluido" || !task.updated_at) return false;
        const when = new Date(task.updated_at);
        return !Number.isNaN(when.getTime()) && isToday(when);
      }),
    [allTasks],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTask(parents.find((task) => task.id === event.active.id) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const overId = over.id as string;
    const target =
      BOARD_COLUMNS.find((column) => column.id === overId)?.id ??
      parents.find((task) => task.id === overId)?.status;
    const current = parents.find((task) => task.id === active.id)?.status;
    if (target && target !== current) {
      changeStatus.mutate({ id: active.id as string, status: target });
    }
  };

  const openTask = (task: BoardTask) => {
    setSelected(task);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Quadro</h3>
          <p className="text-sm text-muted-foreground">
            Arraste os cards entre as colunas — o status é salvo na hora.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm(`Excluir ${selectedIds.size} card(s) selecionado(s)?`))
                    deleteTasks.mutate([...selectedIds]);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Excluir {selectedIds.size}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Limpar seleção
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => createTask.mutate({ title: "Nova tarefa", status: "a_fazer" })}>
            <Plus className="mr-2 h-4 w-4" /> Nova tarefa
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {BOARD_FILTERS.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={
              filter === option.value
                ? option.value === "atrasadas"
                  ? "destructive"
                  : "default"
                : "outline"
            }
            className="h-8 px-3 text-xs"
            onClick={() => setFilter(option.value)}
          >
            {option.label}
            {option.value === "atrasadas" && overdueCount > 0 && ` (${overdueCount})`}
          </Button>
        ))}
      </div>

      <section className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold tracking-tight">
            Concluídos hoje
          </h4>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
            {doneToday.length}
          </span>
        </div>
        {doneToday.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nada concluído hoje ainda — mova cards para “Concluído” e eles aparecem aqui.
          </p>
        ) : (
          <ul className="space-y-1">
            {doneToday.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => openTask(task)}
                  title="Ver histórico e observações"
                  className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/50"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate text-foreground">{task.title}</span>
                  {task.responsible && (
                    <span className="shrink-0 text-xs">· {task.responsible}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando quadro...</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex items-start gap-4 overflow-x-auto pb-4">
            {BOARD_COLUMNS.map((column) => (
              <BoardColumn
                key={column.id}
                id={column.id}
                label={column.label}
                tasks={visible.filter((task) => task.status === column.id)}
                subtaskCounts={subtaskCounts}
                reminders={reminders}
                onOpen={openTask}
                onQuickAdd={(title, status) => createTask.mutate({ title, status })}
                onDelete={(task) => {
                  if (confirm(`Excluir "${task.title}"?`)) deleteTasks.mutate([task.id]);
                }}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? <BoardCard task={activeTask} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <TaskDetailSheet
        task={selected}
        projectId={projectId}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}

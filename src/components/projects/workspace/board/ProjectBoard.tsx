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
import { CheckCircle2, KanbanSquare, List, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity";
import { advanceRecurrence } from "@/lib/recurrence";
import { invalidateReminders } from "@/lib/reminders";
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
  /** Ausente = visão global de todas as tarefas (rota /tarefas). */
  projectId?: string;
}

export function ProjectBoard({ projectId }: ProjectBoardProps) {
  const queryClient = useQueryClient();
  const globalMode = !projectId;
  const [filter, setFilter] = useState<BoardFilter>("todas");
  const [view, setView] = useState<"quadro" | "lista">(globalMode ? "lista" : "quadro");
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const [selected, setSelected] = useState<BoardTask | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<{ ids: string[]; label: string } | null>(null);

  const queryKey = ["board-tasks", projectId ?? "all"];

  const { data: allTasks = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select(globalMode ? "*, projects(name)" : "*")
        .order("created_at", { ascending: false });
      if (projectId) query = query.eq("project_id", projectId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as BoardTask[];
    },
  });

  const taskIds = useMemo(() => allTasks.map((t) => t.id), [allTasks]);

  // Sinos do quadro: lembretes de tarefa pendentes, restritos às tarefas deste
  // quadro — nada de puxar lembrete de projeto que não está na tela.
  const { data: reminderIds = [] } = useQuery({
    queryKey: ["board-reminders", projectId ?? "all", taskIds],
    enabled: taskIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("reminders")
        .select("entity_id")
        .eq("status", "pendente")
        .eq("entity_type", "task")
        .in("entity_id", taskIds);
      return (data ?? []).map((row) => row.entity_id as string).filter(Boolean);
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
      const logProjectId = data?.project_id ?? projectId;
      if (data && logProjectId) {
        await logActivity({
          projectId: logProjectId,
          type: status === "concluido" ? "task_completed" : "task_reopened",
          description: `Card "${data.title}" movido para ${STATUS_LABELS[status]}`,
          entityType: "task",
          entityId: data.id,
        });
      }
      if (status === "concluido" && (data as { recurrence_id?: string | null })?.recurrence_id) {
        await advanceRecurrence((data as { recurrence_id: string }).recurrence_id);
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
        project_id: projectId ?? null,
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
      // Lembretes ligados às tarefas somem por trigger no banco (trg_delete_task_reminders).
      const { error } = await supabase.from("tasks").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_data, ids) => {
      setSelectedIds(new Set());
      toast.success(ids.length > 1 ? `${ids.length} cards excluídos` : "Card excluído");
      invalidate();
      invalidateReminders(queryClient);
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

  /** Visão Lista: tarefas em aberto agrupadas por etiqueta. */
  const listGroups = useMemo(() => {
    const groups = new Map<string, BoardTask[]>();
    for (const task of visible) {
      if (task.status === "concluido") continue;
      const key = task.category?.trim() || "Sem etiqueta";
      const bucket = groups.get(key) ?? [];
      bucket.push(task);
      groups.set(key, bucket);
    }
    return [...groups.entries()].sort((a, b) => {
      if (a[0] === "Sem etiqueta") return 1;
      if (b[0] === "Sem etiqueta") return -1;
      return a[0].localeCompare(b[0], "pt-BR");
    });
  }, [visible]);

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
          <h3 className="text-lg font-semibold tracking-tight">
            {globalMode ? "Todas as tarefas" : "Tarefas"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {view === "quadro"
              ? "Arraste os cards entre as colunas — o status é salvo na hora."
              : "Lista agrupada por etiqueta."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            <Button
              size="sm"
              variant={view === "lista" ? "default" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={() => setView("lista")}
            >
              <List className="mr-1 h-3.5 w-3.5" /> Lista
            </Button>
            <Button
              size="sm"
              variant={view === "quadro" ? "default" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={() => setView("quadro")}
            >
              <KanbanSquare className="mr-1 h-3.5 w-3.5" /> Quadro
            </Button>
          </div>
          {selectedIds.size > 0 && (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={() =>
                  setPendingDelete({
                    ids: [...selectedIds],
                    label: `${selectedIds.size} tarefa(s) selecionada(s)`,
                  })
                }
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
        <p className="text-sm text-muted-foreground">Carregando tarefas...</p>
      ) : view === "lista" ? (
        <div className="space-y-5">
          {listGroups.length === 0 ? (
            <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              Nenhuma tarefa em aberto neste filtro.
            </p>
          ) : (
            listGroups.map(([label, groupTasks]) => (
              <div key={label} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </h4>
                  <span className="text-xs text-muted-foreground">{groupTasks.length}</span>
                </div>
                <ul className="divide-y rounded-xl border bg-card">
                  {groupTasks.map((task) => {
                    const overdue = isOverdue(task);
                    return (
                      <li key={task.id}>
                        <div className="flex items-center gap-3 px-3 py-2.5 text-sm">
                          <button
                            type="button"
                            aria-label="Concluir tarefa"
                            className="shrink-0 rounded-full text-muted-foreground transition-colors hover:text-primary"
                            onClick={() =>
                              changeStatus.mutate({ id: task.id, status: "concluido" })
                            }
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openTask(task)}
                            className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-left"
                          >
                            <span className="truncate font-medium">{task.title}</span>
                            {globalMode && task.projects?.name && (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                                {task.projects.name}
                              </span>
                            )}
                            {task.priority === "alta" && (
                              <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-destructive">
                                Alta
                              </span>
                            )}
                            {task.status === "aguardando_terceiro" && (
                              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                                Aguardando{task.waiting_for ? `: ${task.waiting_for}` : ""}
                              </span>
                            )}
                          </button>
                          {task.deadline && (
                            <span
                              className={
                                "shrink-0 text-xs " +
                                (overdue ? "font-semibold text-destructive" : "text-muted-foreground")
                              }
                            >
                              {parseLocalDate(task.deadline)!.toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "short",
                              })}
                            </span>
                          )}
                          <button
                            type="button"
                            aria-label="Excluir tarefa"
                            className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => {
                              setPendingDelete({ ids: [task.id], label: `"${task.title}"` });
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
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
                  setPendingDelete({ ids: [task.id], label: `"${task.title}"` });
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
        projectId={projectId ?? null}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setSelected(null);
        }}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {pendingDelete?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              A ação não pode ser desfeita. Subtarefas e lembretes ligados também somem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) deleteTasks.mutate(pendingDelete.ids);
                setPendingDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

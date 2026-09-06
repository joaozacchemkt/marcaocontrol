import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { Bell, BellOff, Check, History, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { logActivity } from "@/lib/activity";
import { advanceRecurrence } from "@/lib/recurrence";
import { toast } from "sonner";
import { SUGGESTED_TAGS } from "@/lib/task-tags";
import { BOARD_COLUMNS, type BoardStatus, type BoardTask } from "./board-types";

export interface TaskDetailSheetProps {
  task: BoardTask | null;
  /** Projeto da tarefa. Ausente na visão global de tarefas soltas. */
  projectId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailSheet({ task, projectId, open, onOpenChange }: TaskDetailSheetProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    description: "",
    notes: "",
    responsible: "",
    category: "",
    waiting_for: "",
    deadline: "",
    priority: "media",
    status: "a_fazer" as BoardStatus,
    contact_id: "none",
  });
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [observation, setObservation] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!task) return;
    setForm({
      title: task.title ?? "",
      description: task.description ?? "",
      notes: task.notes ?? "",
      responsible: task.responsible ?? "",
      category: task.category ?? "",
      waiting_for: task.waiting_for ?? "",
      deadline: task.deadline ? task.deadline.slice(0, 10) : "",
      priority: task.priority ?? "media",
      status: task.status,
      contact_id: task.contact_id ?? "none",
    });
  }, [task]);

  const taskProjectId = task?.project_id ?? projectId ?? null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["board-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["board-reminders"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-tasks"] });
  };

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-select"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, name");
      return data ?? [];
    },
  });

  const { data: subtasks = [] } = useQuery({
    queryKey: ["subtasks", task?.id],
    enabled: Boolean(task?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status")
        .eq("parent_task_id", task!.id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: reminder } = useQuery({
    queryKey: ["task-reminder", task?.id],
    enabled: Boolean(task?.id),
    queryFn: async () => {
      const { data } = await supabase
        .from("reminders")
        .select("id")
        .eq("entity_id", task!.id)
        .eq("status", "pendente")
        .maybeSingle();
      return data;
    },
  });

  /** Histórico da tarefa: tudo o que aconteceu com este card, com observações. */
  const { data: history = [] } = useQuery({
    queryKey: ["task-history", task?.id],
    enabled: Boolean(task?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_history")
        .select("id, action, description, details, created_at")
        .eq("entity_id", task!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addObservation = useMutation({
    mutationFn: async (note: string) => {
      if (!task || !taskProjectId) return;
      await logActivity({
        projectId: taskProjectId,
        type: "note_created",
        description: `Observação em "${form.title || task.title}"`,
        entityType: "task",
        entityId: task.id,
        details: { note },
      });
    },
    onSuccess: () => {
      setObservation("");
      queryClient.invalidateQueries({ queryKey: ["task-history", task?.id] });
      queryClient.invalidateQueries({ queryKey: ["activity-history"] });
      toast.success("Observação registrada no histórico");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!task) return;
      const { error } = await supabase
        .from("tasks")
        .update({
          title: form.title.trim() || "Sem título",
          description: form.description || null,
          notes: form.notes || null,
          responsible: form.responsible || null,
          category: form.category || null,
          waiting_for: form.waiting_for || null,
          deadline: form.deadline ? new Date(`${form.deadline}T12:00:00`).toISOString() : null,
          priority: form.priority as "baixa" | "media" | "alta",
          status: form.status as never,
          contact_id: form.contact_id === "none" ? null : form.contact_id,
        })
        .eq("id", task.id);
      if (error) throw error;
      if (
        form.status === "concluido" &&
        task.status !== "concluido" &&
        (task as { recurrence_id?: string | null }).recurrence_id
      ) {
        await advanceRecurrence((task as { recurrence_id: string }).recurrence_id);
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success("Card atualizado");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addSubtask = useMutation({
    mutationFn: async (title: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !task) throw new Error("Sessão expirada.");
      const { error } = await supabase.from("tasks").insert({
        user_id: user.id,
        project_id: taskProjectId,
        parent_task_id: task.id,
        title,
        status: "a_fazer",
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setSubtaskTitle("");
      queryClient.invalidateQueries({ queryKey: ["subtasks", task?.id] });
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleSubtask = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: done ? "concluido" : "a_fazer" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subtasks", task?.id] }),
  });

  const removeSubtask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks", task?.id] });
      invalidate();
    },
  });

  const toggleReminder = useMutation({
    mutationFn: async () => {
      if (!task) return;
      if (reminder) {
        const { error } = await supabase.from("reminders").delete().eq("id", reminder.id);
        if (error) throw error;
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");
      const remindAt = form.deadline
        ? new Date(`${form.deadline}T09:00:00`).toISOString()
        : new Date(Date.now() + 86400000).toISOString();
      const { error } = await supabase.from("reminders").insert({
        user_id: user.id,
        project_id: taskProjectId,
        entity_type: "task",
        entity_id: task.id,
        title: form.title || task.title,
        remind_at: remindAt,
        channel: "sistema",
        status: "pendente",
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-reminder", task?.id] });
      queryClient.invalidateQueries({ queryKey: ["board-reminders"] });
      queryClient.invalidateQueries({ queryKey: ["today-reminders"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const complete = useMutation({
    mutationFn: async () => {
      if (!task) return;
      const { error } = await supabase
        .from("tasks")
        .update({ status: "concluido" })
        .eq("id", task.id);
      if (error) throw error;
      if ((task as { recurrence_id?: string | null }).recurrence_id) {
        await advanceRecurrence((task as { recurrence_id: string }).recurrence_id);
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success("Card concluído");
      onOpenChange(false);
    },
  });

  const removeTask = useMutation({
    mutationFn: async () => {
      if (!task) return;
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      onOpenChange(false);
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Detalhes do card</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="detail-title">Título</Label>
            <Input
              id="detail-title"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="detail-status">Coluna</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((p) => ({ ...p, status: v as BoardStatus }))}
              >
                <SelectTrigger id="detail-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOARD_COLUMNS.map((column) => (
                    <SelectItem key={column.id} value={column.id}>
                      {column.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-priority">Prioridade</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm((p) => ({ ...p, priority: v }))}
              >
                <SelectTrigger id="detail-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="detail-deadline">Prazo</Label>
              <Input
                id="detail-deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-category">Etiqueta</Label>
              <Input
                id="detail-category"
                placeholder="Ex.: financeiro"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  setForm((p) => ({ ...p, category: p.category === tag ? "" : tag }))
                }
                className={
                  "rounded-full border px-2.5 py-0.5 text-xs transition-colors " +
                  (form.category === tag
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input hover:bg-muted")
                }
              >
                {tag}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="detail-responsible">Responsável</Label>
              <Input
                id="detail-responsible"
                value={form.responsible}
                onChange={(e) => setForm((p) => ({ ...p, responsible: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-waiting">Aguardando quem?</Label>
              <Input
                id="detail-waiting"
                value={form.waiting_for}
                onChange={(e) => setForm((p) => ({ ...p, waiting_for: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="detail-contact">Contato vinculado</Label>
            <Select
              value={form.contact_id}
              onValueChange={(v) => setForm((p) => ({ ...p, contact_id: v }))}
            >
              <SelectTrigger id="detail-contact">
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {contacts.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="detail-description">Descrição</Label>
            <Textarea
              id="detail-description"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="detail-notes">Observações</Label>
            <Textarea
              id="detail-notes"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Subtarefas</Label>
              <Badge variant="secondary" className="text-[10px]">
                {subtasks.filter((s) => s.status === "concluido").length}/{subtasks.length}
              </Badge>
            </div>
            <div className="space-y-1">
              {subtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2 rounded-md border px-2 py-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label="Concluir subtarefa"
                    onClick={() =>
                      toggleSubtask.mutate({
                        id: subtask.id,
                        done: subtask.status !== "concluido",
                      })
                    }
                  >
                    <Check
                      className={
                        subtask.status === "concluido"
                          ? "h-3.5 w-3.5 text-primary"
                          : "h-3.5 w-3.5 text-muted-foreground"
                      }
                    />
                  </Button>
                  <span
                    className={
                      subtask.status === "concluido"
                        ? "flex-1 text-xs text-muted-foreground line-through"
                        : "flex-1 text-xs"
                    }
                  >
                    {subtask.title}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label="Remover subtarefa"
                    onClick={() => removeSubtask.mutate(subtask.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={subtaskTitle}
                placeholder="Nova subtarefa..."
                onChange={(e) => setSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && subtaskTitle.trim()) {
                    addSubtask.mutate(subtaskTitle.trim());
                  }
                }}
                className="h-9 text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!subtaskTitle.trim()}
                onClick={() => addSubtask.mutate(subtaskTitle.trim())}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border bg-accent/20 p-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <Label>Histórico da tarefa</Label>
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {history.length}
              </Badge>
            </div>

            <div className="flex gap-2">
              <Input
                value={observation}
                placeholder="Adicionar observação..."
                onChange={(e) => setObservation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && observation.trim()) {
                    addObservation.mutate(observation.trim());
                  }
                }}
                className="h-9 text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!observation.trim() || addObservation.isPending}
                onClick={() => addObservation.mutate(observation.trim())}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sem registros ainda — mudanças de status e observações aparecem aqui.
              </p>
            ) : (
              <ul className="max-h-52 space-y-2 overflow-y-auto pr-1">
                {history.map((entry) => {
                  const note =
                    entry.details && typeof entry.details === "object" && !Array.isArray(entry.details)
                      ? ((entry.details as Record<string, unknown>)["note"] as string | undefined)
                      : typeof entry.details === "string"
                        ? entry.details
                        : undefined;
                  return (
                    <li key={entry.id} className="rounded-md border bg-card px-2 py-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium">{entry.description}</p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {format(new Date(entry.created_at as string), "dd/MM HH:mm", {
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                      {note && (
                        <p className="mt-1 text-[11px] italic text-muted-foreground">“{note}”</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => toggleReminder.mutate()}>
              {reminder ? (
                <>
                  <BellOff className="mr-2 h-4 w-4" /> Remover lembrete
                </>
              ) : (
                <>
                  <Bell className="mr-2 h-4 w-4" /> Marcar lembrete
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={() => complete.mutate()}>
              <Check className="mr-2 h-4 w-4" /> Concluir
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </Button>
            <Button size="sm" className="ml-auto" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </SheetContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{task?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              A ação não pode ser desfeita. Subtarefas e lembretes ligados também somem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDelete(false);
                removeTask.mutate();
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

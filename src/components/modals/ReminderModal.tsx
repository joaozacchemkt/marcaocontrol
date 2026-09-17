import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { useGuardedSubmit } from "@/lib/use-guarded-submit";
import {
  combineDateTime,
  invalidateReminders,
  REMINDER_FREQUENCY_LABELS,
  type ReminderFrequency,
} from "@/lib/reminders";
import { todayLocalStr } from "@/lib/dates";
import { SUGGESTED_TAGS } from "@/lib/task-tags";
import { format } from "date-fns";
import { Repeat } from "lucide-react";

export interface ReminderRow {
  id: string;
  title: string;
  remind_at: string;
  project_id: string | null;
  notes: string | null;
  entity_type: string | null;
  entity_id: string | null;
  status: string;
  priority: "baixa" | "media" | "alta";
  category: string | null;
  recurrence_frequency: string | null;
  recurrence_interval: number;
  recurrence_end_date: string | null;
}

interface ReminderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presente = modo edição. */
  reminder?: ReminderRow | null;
  /** Vínculo opcional (ex.: lembrete criado a partir de uma tarefa). */
  entityType?: string | null;
  entityId?: string | null;
  defaultTitle?: string;
  defaultProjectId?: string | null;
}

const emptyForm = {
  title: "",
  date: "",
  time: "09:00",
  project_id: "none",
  notes: "",
  priority: "media" as "baixa" | "media" | "alta",
  category: "",
  recurrence_frequency: "none" as ReminderFrequency | "none",
  recurrence_interval: "1",
  recurrence_end_date: "",
};

export function ReminderModal({
  open,
  onOpenChange,
  reminder,
  entityType,
  entityId,
  defaultTitle,
  defaultProjectId,
}: ReminderModalProps) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(reminder?.id);
  const [form, setForm] = useState(emptyForm);
  // Preenche o formulário só na abertura — mudanças de props enquanto o modal
  // está aberto (ex.: refetch do quadro trocando defaultTitle) não apagam o
  // que o usuário está digitando.
  const initialized = useRef(false);

  useEffect(() => {
    if (!open) {
      initialized.current = false;
      return;
    }
    if (initialized.current) return;
    initialized.current = true;

    if (reminder?.id) {
      const d = new Date(reminder.remind_at);
      const valid = !Number.isNaN(d.getTime());
      setForm({
        title: reminder.title ?? "",
        date: valid ? format(d, "yyyy-MM-dd") : "",
        time: valid ? format(d, "HH:mm") : "09:00",
        project_id: reminder.project_id ?? "none",
        notes: reminder.notes ?? "",
        priority: reminder.priority ?? "media",
        category: reminder.category ?? "",
        recurrence_frequency: (reminder.recurrence_frequency as ReminderFrequency | null) ?? "none",
        recurrence_interval: String(reminder.recurrence_interval ?? 1),
        recurrence_end_date: reminder.recurrence_end_date ?? "",
      });
      return;
    }
    setForm({
      ...emptyForm,
      date: todayLocalStr(),
      title: defaultTitle ?? "",
      project_id: defaultProjectId ?? "none",
    });
  }, [open, reminder, defaultTitle, defaultProjectId]);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-select"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name").order("name");
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");

      const title = form.title.trim();
      if (!title) throw new Error("Dê um título ao lembrete.");
      if (!form.date) throw new Error("Escolha a data do lembrete.");
      const when = combineDateTime(form.date, form.time);
      if (Number.isNaN(when.getTime())) throw new Error("Data ou hora inválida.");
      if (form.recurrence_end_date && form.recurrence_end_date < form.date) {
        throw new Error("A data final da recorrência não pode ser antes da data do lembrete.");
      }

      const projectId = form.project_id !== "none" ? form.project_id : null;
      const recurrenceFrequency = form.recurrence_frequency !== "none" ? form.recurrence_frequency : null;
      const recurrenceInterval = Math.max(1, Number.parseInt(form.recurrence_interval, 10) || 1);

      const shared = {
        title,
        remind_at: when.toISOString(),
        project_id: projectId,
        notes: form.notes.trim() || null,
        priority: form.priority,
        category: form.category.trim() || null,
        recurrence_frequency: recurrenceFrequency,
        recurrence_interval: recurrenceInterval,
        recurrence_end_date: recurrenceFrequency ? form.recurrence_end_date || null : null,
      };

      if (isEditing && reminder) {
        const { error } = await supabase.from("reminders").update(shared).eq("id", reminder.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("reminders").insert({
        ...shared,
        user_id: user.id,
        entity_type: entityType ?? null,
        entity_id: entityId ?? null,
        channel: "sistema",
        status: "pendente",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateReminders(queryClient);
      toast.success(isEditing ? "Lembrete atualizado" : "Lembrete criado");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = useGuardedSubmit(() => save.mutate(), save.isPending);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar lembrete" : "Novo lembrete"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-4 py-2"
        >
          <div className="space-y-2">
            <Label htmlFor="reminder-title">Lembrar de *</Label>
            <Input
              id="reminder-title"
              autoFocus
              placeholder="Ex.: Ligar para o contador"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="reminder-date">Data *</Label>
              <Input
                id="reminder-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder-time">Hora</Label>
              <Input
                id="reminder-time"
                type="time"
                value={form.time}
                onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="reminder-project">Projeto</Label>
              <Select
                value={form.project_id}
                onValueChange={(v) => setForm((p) => ({ ...p, project_id: v }))}
              >
                <SelectTrigger id="reminder-project">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder-priority">Prioridade</Label>
              <Select
                value={form.priority}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, priority: v as "baixa" | "media" | "alta" }))
                }
              >
                <SelectTrigger id="reminder-priority">
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

          <div className="space-y-2">
            <Label htmlFor="reminder-category">Categoria</Label>
            <Input
              id="reminder-category"
              placeholder="Ex.: Financeiro"
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
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
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <Label htmlFor="reminder-recurrence" className="flex items-center gap-1.5">
              <Repeat className="h-3.5 w-3.5" /> Repetir
            </Label>
            <Select
              value={form.recurrence_frequency}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, recurrence_frequency: v as ReminderFrequency | "none" }))
              }
            >
              <SelectTrigger id="reminder-recurrence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não repetir</SelectItem>
                {Object.entries(REMINDER_FREQUENCY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {form.recurrence_frequency !== "none" && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-2">
                  <Label htmlFor="reminder-recurrence-interval">A cada</Label>
                  <Input
                    id="reminder-recurrence-interval"
                    type="number"
                    min={1}
                    value={form.recurrence_interval}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, recurrence_interval: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reminder-recurrence-end">Até (opcional)</Label>
                  <Input
                    id="reminder-recurrence-end"
                    type="date"
                    value={form.recurrence_end_date}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, recurrence_end_date: e.target.value }))
                    }
                  />
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Ao concluir, o próximo lembrete é criado automaticamente.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder-notes">Observação</Label>
            <Textarea
              id="reminder-notes"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Salvando..." : isEditing ? "Salvar" : "Criar lembrete"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

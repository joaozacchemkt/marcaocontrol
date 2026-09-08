import { useEffect, useState } from "react";
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
import { combineDateTime, invalidateReminders } from "@/lib/reminders";
import { format } from "date-fns";

export interface ReminderRow {
  id: string;
  title: string;
  remind_at: string;
  project_id: string | null;
  notes: string | null;
  entity_type: string | null;
  entity_id: string | null;
  status: string;
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

  useEffect(() => {
    if (!open) return;
    if (reminder?.id) {
      const d = new Date(reminder.remind_at);
      const valid = !Number.isNaN(d.getTime());
      setForm({
        title: reminder.title ?? "",
        date: valid ? format(d, "yyyy-MM-dd") : "",
        time: valid ? format(d, "HH:mm") : "09:00",
        project_id: reminder.project_id ?? "none",
        notes: reminder.notes ?? "",
      });
      return;
    }
    setForm({
      ...emptyForm,
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

      const projectId = form.project_id !== "none" ? form.project_id : null;

      if (isEditing && reminder) {
        const { error } = await supabase
          .from("reminders")
          .update({
            title,
            remind_at: when.toISOString(),
            project_id: projectId,
            notes: form.notes.trim() || null,
          })
          .eq("id", reminder.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("reminders").insert({
        user_id: user.id,
        title,
        remind_at: when.toISOString(),
        project_id: projectId,
        notes: form.notes.trim() || null,
        entity_type: entityType ?? null,
        entity_id: entityId ?? null,
        channel: "sistema",
        status: "pendente",
      } as never);
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

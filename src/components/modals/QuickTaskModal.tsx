import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { logActivity } from "@/lib/activity";
import { useGuardedSubmit } from "@/lib/use-guarded-submit";
import { SUGGESTED_TAGS } from "@/lib/task-tags";

interface QuickTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProjectId?: string;
  initialContactId?: string;
}

const emptyForm = {
  title: "",
  description: "",
  project_id: "none",
  contact_id: "none",
  responsible: "",
  deadline: "",
  priority: "media" as "baixa" | "media" | "alta",
  category: "",
};

/**
 * Cadastro rápido de tarefa — o mesmo modelo do Quadro (`tasks`, status
 * `a_fazer`). Substitui o antigo `TaskModal`, que carregava campos de
 * controle de tempo e status que ninguém usava.
 */
export function QuickTaskModal({
  open,
  onOpenChange,
  initialProjectId,
  initialContactId,
}: QuickTaskModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...emptyForm,
      project_id: initialProjectId || "none",
      contact_id: initialContactId || "none",
    });
  }, [open, initialProjectId, initialContactId]);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-select"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-select"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, name").order("name");
      return data || [];
    },
  });

  const createTask = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sessão expirada.");
      if (!form.title.trim()) throw new Error("Dê um título para a tarefa.");

      const { data: created, error } = await supabase
        .from("tasks")
        .insert({
          user_id: userData.user.id,
          title: form.title.trim(),
          description: form.description.trim() || null,
          project_id: form.project_id !== "none" ? form.project_id : null,
          contact_id: form.contact_id !== "none" ? form.contact_id : null,
          responsible: form.responsible.trim() || null,
          deadline: form.deadline || null,
          priority: form.priority,
          category: form.category.trim() || null,
          status: "a_fazer",
        } as never)
        .select()
        .single();
      if (error) throw error;

      if (created?.project_id) {
        await logActivity({
          projectId: created.project_id,
          type: "task_created",
          description: `Nova tarefa: "${created.title}"`,
          entityType: "task",
          entityId: created.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["board-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks-calendar"] });
      toast.success("Tarefa criada");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = useGuardedSubmit(() => createTask.mutate(), createTask.isPending);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-4 py-2"
        >
          <div className="space-y-2">
            <Label htmlFor="qt-title">O que precisa ser feito? *</Label>
            <Input
              id="qt-title"
              autoFocus
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="qt-project">Projeto</Label>
              <Select
                value={form.project_id}
                onValueChange={(v) => setForm((p) => ({ ...p, project_id: v }))}
              >
                <SelectTrigger id="qt-project">
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
              <Label htmlFor="qt-contact">Contato</Label>
              <Select
                value={form.contact_id}
                onValueChange={(v) => setForm((p) => ({ ...p, contact_id: v }))}
              >
                <SelectTrigger id="qt-contact">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="qt-deadline">Prazo</Label>
              <Input
                id="qt-deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qt-priority">Prioridade</Label>
              <Select
                value={form.priority}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, priority: v as "baixa" | "media" | "alta" }))
                }
              >
                <SelectTrigger id="qt-priority">
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
            <Label htmlFor="qt-category">Etiqueta</Label>
            <Input
              id="qt-category"
              placeholder="Ex.: financeiro"
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

          <div className="space-y-2">
            <Label htmlFor="qt-description">Detalhes (opcional)</Label>
            <Textarea
              id="qt-description"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createTask.isPending}>
              {createTask.isPending ? "Salvando..." : "Criar tarefa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
